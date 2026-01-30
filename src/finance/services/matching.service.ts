import { Injectable, Inject } from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ContactPaymentMethod from '../entities/contact-payment-method.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Contact from '../../crm/entities/contact.entity';
import Phone from '../../crm/entities/phone.entity';
import { MatchType } from '../enums/match-type.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';
import { normalizePhone, calculateNameSimilarity } from '../finance.helpers';
import { ReconciliationPluginRegistry } from '../plugins/reconciliation-plugin.registry';
import {
  IReconciliationPlugin,
  MatchResult,
} from '../interfaces/reconciliation-plugin.interface';

interface MatchCandidate {
  contact: Contact;
  confidenceScore: number;
  matchCriteria: {
    method: string;
    matchedValue?: string;
    similarity?: number;
    historicalBonus?: boolean;
  };
}

@Injectable()
export class MatchingService {
  private readonly transactionRepository: Repository<Transaction>;
  private readonly matchRepository: Repository<ReconciliationMatch>;
  private readonly paymentMethodRepository: Repository<ContactPaymentMethod>;
  private readonly contactRepository: Repository<Contact>;
  private readonly phoneRepository: Repository<Phone>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
    private pluginRegistry: ReconciliationPluginRegistry,
  ) {
    this.transactionRepository = connection.getRepository(Transaction);
    this.matchRepository = connection.getRepository(ReconciliationMatch);
    this.paymentMethodRepository = connection.getRepository(ContactPaymentMethod);
    this.contactRepository = connection.getRepository(Contact);
    this.phoneRepository = connection.getRepository(Phone);
    this.logger = this.appLogger.createContextLogger('MatchingService');
  }

  async findMatchForTransaction(
    transaction: Transaction,
    pluginId?: string,
  ): Promise<MatchCandidate | null> {
    const tenantId = this.tenantContext.requireTenant();

    // Try plugin custom matching first if available
    const plugin = pluginId
      ? this.pluginRegistry.get(pluginId)
      : this.pluginRegistry.getDefault();

    if (plugin?.customMatchLogic) {
      const contacts = await this.contactRepository.find({
        where: { tenant: { id: tenantId } },
        relations: ['person', 'phones'],
      });

      const pluginResult = await plugin.customMatchLogic(transaction, contacts);
      if (pluginResult) {
        return {
          contact: pluginResult.contact,
          confidenceScore: pluginResult.confidenceScore,
          matchCriteria: pluginResult.matchCriteria,
        };
      }
    }

    // Strategy 1: Exact phone match via ContactPaymentMethod (95% confidence)
    if (transaction.senderPhoneNormalized) {
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          tenant: { id: tenantId },
          valueNormalized: transaction.senderPhoneNormalized,
        },
        relations: ['contact', 'contact.person'],
      });

      if (paymentMethod?.contact) {
        const hasHistoricalMatch = await this.hasApprovedHistoricalMatch(
          paymentMethod.contact.id,
          tenantId,
        );

        return {
          contact: paymentMethod.contact,
          confidenceScore: hasHistoricalMatch ? 100 : 95,
          matchCriteria: {
            method: 'payment_method_phone',
            matchedValue: transaction.senderPhoneNormalized,
            historicalBonus: hasHistoricalMatch,
          },
        };
      }
    }

    // Strategy 2: Phone match via Contact.phones (90% confidence)
    if (transaction.senderPhoneNormalized) {
      const phone = await this.phoneRepository.findOne({
        where: {
          value: transaction.senderPhoneNormalized,
        },
        relations: ['contact', 'contact.person', 'contact.tenant'],
      });

      if (phone?.contact && phone.contact.tenant?.id === tenantId) {
        const hasHistoricalMatch = await this.hasApprovedHistoricalMatch(
          phone.contact.id,
          tenantId,
        );

        return {
          contact: phone.contact,
          confidenceScore: hasHistoricalMatch ? 100 : 90,
          matchCriteria: {
            method: 'contact_phone',
            matchedValue: transaction.senderPhoneNormalized,
            historicalBonus: hasHistoricalMatch,
          },
        };
      }

      // Try normalized phone lookup
      const normalizedPhone = normalizePhone(transaction.senderPhone);
      if (normalizedPhone) {
        const phones = await this.phoneRepository
          .createQueryBuilder('phone')
          .leftJoinAndSelect('phone.contact', 'contact')
          .leftJoinAndSelect('contact.person', 'person')
          .leftJoinAndSelect('contact.tenant', 'tenant')
          .where('tenant.id = :tenantId', { tenantId })
          .getMany();

        for (const p of phones) {
          const normalizedContactPhone = normalizePhone(p.value);
          if (normalizedContactPhone === normalizedPhone && p.contact) {
            const hasHistoricalMatch = await this.hasApprovedHistoricalMatch(
              p.contact.id,
              tenantId,
            );

            return {
              contact: p.contact,
              confidenceScore: hasHistoricalMatch ? 100 : 90,
              matchCriteria: {
                method: 'contact_phone_normalized',
                matchedValue: normalizedPhone,
                historicalBonus: hasHistoricalMatch,
              },
            };
          }
        }
      }
    }

    // Strategy 3: Fuzzy name match (60-85% confidence based on similarity)
    if (transaction.senderName) {
      const contacts = await this.contactRepository.find({
        where: { tenant: { id: tenantId } },
        relations: ['person'],
      });

      let bestMatch: MatchCandidate | null = null;

      for (const contact of contacts) {
        if (!contact.person) continue;

        const fullName = `${contact.person.firstName || ''} ${contact.person.middleName || ''} ${contact.person.lastName || ''}`.trim();
        const similarity = calculateNameSimilarity(
          transaction.senderName,
          fullName,
        );

        // Only consider matches with similarity >= 0.6 (60%)
        if (similarity >= 0.6) {
          const baseConfidence = Math.round(60 + similarity * 25); // 60-85%
          const hasHistoricalMatch = await this.hasApprovedHistoricalMatch(
            contact.id,
            tenantId,
          );
          const confidenceScore = hasHistoricalMatch
            ? Math.min(baseConfidence + 10, 100)
            : baseConfidence;

          if (!bestMatch || confidenceScore > bestMatch.confidenceScore) {
            bestMatch = {
              contact,
              confidenceScore,
              matchCriteria: {
                method: 'fuzzy_name',
                matchedValue: fullName,
                similarity: Math.round(similarity * 100),
                historicalBonus: hasHistoricalMatch,
              },
            };
          }
        }
      }

      if (bestMatch) {
        return bestMatch;
      }
    }

    return null;
  }

  private async hasApprovedHistoricalMatch(
    contactId: number,
    tenantId: number,
  ): Promise<boolean> {
    const count = await this.matchRepository.count({
      where: {
        tenant: { id: tenantId },
        contact: { id: contactId },
        status: MatchStatus.APPROVED,
      },
    });
    return count > 0;
  }

  async runMatching(
    accountId: number,
    minConfidenceThreshold: number = 60,
    autoApproveAboveThreshold?: number,
    pluginId?: string,
    user?: any,
  ): Promise<{
    processed: number;
    matched: number;
    autoApproved: number;
    errors: string[];
  }> {
    const tenantId = this.tenantContext.requireTenant();

    this.logger.business('log', 'Starting matching process', {
      operation: 'runMatching',
      userId: user?.id,
      metadata: {
        accountId,
        minConfidenceThreshold,
        autoApproveAboveThreshold,
        pluginId,
      },
    });

    const transactions = await this.transactionRepository.find({
      where: {
        tenant: { id: tenantId },
        account: { id: accountId },
        status: 'PENDING' as any,
      },
      relations: ['account'],
    });

    let processed = 0;
    let matched = 0;
    let autoApproved = 0;
    const errors: string[] = [];

    for (const transaction of transactions) {
      processed++;

      try {
        // Check if transaction already has a match
        const existingMatch = await this.matchRepository.findOne({
          where: {
            tenant: { id: tenantId },
            transaction: { id: transaction.id },
          },
        });

        if (existingMatch) {
          continue;
        }

        const matchResult = await this.findMatchForTransaction(
          transaction,
          pluginId,
        );

        if (matchResult && matchResult.confidenceScore >= minConfidenceThreshold) {
          const match = new ReconciliationMatch();
          match.tenant = { id: tenantId } as any;
          match.transaction = transaction;
          match.contact = matchResult.contact;
          match.matchType = MatchType.AUTO;
          match.confidenceScore = matchResult.confidenceScore;
          match.matchCriteria = matchResult.matchCriteria;

          // Auto-approve if above threshold
          if (
            autoApproveAboveThreshold &&
            matchResult.confidenceScore >= autoApproveAboveThreshold
          ) {
            match.status = MatchStatus.APPROVED;
            match.approvedAt = new Date();
            autoApproved++;
          } else {
            match.status =
              matchResult.confidenceScore >= 80
                ? MatchStatus.PENDING
                : MatchStatus.PENDING;
          }

          await this.matchRepository.save(match);
          matched++;
        }
      } catch (error) {
        errors.push(`Transaction ${transaction.id}: ${error.message}`);
      }
    }

    this.logger.business('log', 'Matching process completed', {
      operation: 'runMatching',
      userId: user?.id,
      metadata: { processed, matched, autoApproved, errorCount: errors.length },
    });

    return { processed, matched, autoApproved, errors };
  }
}
