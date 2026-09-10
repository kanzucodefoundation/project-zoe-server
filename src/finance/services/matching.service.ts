import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ContactPaymentMethod from '../entities/contact-payment-method.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Contact from '../../crm/entities/contact.entity';
import Phone from '../../crm/entities/phone.entity';
import { MatchType } from '../enums/match-type.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { getPersonFullName } from '../../crm/crm.helpers';
import { MatchSuggestionDto } from '../dto/reconciliation.dto';
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
    /**
     * Name similarity as a whole percentage (0-100), not a 0-1 fraction.
     * calculateNameSimilarity returns a fraction; producers scale it once
     * before storing it here, so consumers must use it as-is.
     */
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
    this.paymentMethodRepository =
      connection.getRepository(ContactPaymentMethod);
    this.contactRepository = connection.getRepository(Contact);
    this.phoneRepository = connection.getRepository(Phone);
    this.logger = this.appLogger.createContextLogger('MatchingService');
  }

  /**
   * Human-readable labels for the internal match methods, so the reconciliation
   * screen can explain *why* a contact was suggested rather than showing a
   * bare identifier like "contact_phone_normalized".
   */
  private static readonly MATCH_METHOD_LABELS: Record<string, string> = {
    payment_method_phone: 'Registered payment method phone',
    contact_phone: 'Contact phone number',
    contact_phone_normalized: 'Contact phone number (normalised)',
    fuzzy_name: 'Similar sender name',
  };

  /**
   * Suggestions for the manual match dialog. Returns an array because that is
   * what the screen renders; the matcher currently produces at most one
   * candidate, so the array holds zero or one entry.
   */
  async getSuggestionsForTransaction(
    transactionId: number,
    user: any,
    pluginId?: string,
  ): Promise<MatchSuggestionDto[]> {
    const tenantId = this.tenantContext.requireTenant();

    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, tenant: { id: tenantId } },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID ${transactionId} not found`,
      );
    }

    this.logger.business('log', 'Fetching match suggestions', {
      operation: 'getMatchSuggestions',
      userId: user?.id,
      resourceId: transactionId,
      resource: 'transaction',
    });

    const candidate = await this.findMatchForTransaction(transaction, pluginId);
    if (!candidate) {
      return [];
    }

    // findMatchForTransaction takes several paths and not all of them load the
    // person/phones relations, so re-read the contact for a consistent shape.
    const contact = await this.contactRepository.findOne({
      where: { id: candidate.contact.id, tenant: { id: tenantId } },
      relations: ['person', 'phones'],
    });

    if (!contact) {
      return [];
    }

    const criteria = candidate.matchCriteria || ({} as any);
    const matchReasons: string[] = [];

    const label =
      MatchingService.MATCH_METHOD_LABELS[criteria.method] || criteria.method;
    if (label) {
      matchReasons.push(label);
    }
    if (criteria.matchedValue) {
      matchReasons.push(`Matched on ${criteria.matchedValue}`);
    }
    if (typeof criteria.similarity === 'number') {
      // Already a whole percentage where it is produced, so do not rescale.
      matchReasons.push(`${Math.round(criteria.similarity)}% name similarity`);
    }
    if (criteria.historicalBonus) {
      matchReasons.push('Previously reconciled to this contact');
    }

    return [
      {
        contact: {
          id: contact.id,
          name: getPersonFullName(contact.person) || `Contact ${contact.id}`,
          phone: contact.phones?.[0]?.value ?? undefined,
        },
        confidenceScore: candidate.confidenceScore,
        matchReasons,
      },
    ];
  }

  async findMatchForTransaction(
    transaction: Transaction,
    pluginId?: string,
  ): Promise<MatchCandidate | null> {
    const tenantId = this.tenantContext.requireTenant();

    // Pre-fetch all contact IDs that have at least one approved match in this
    // tenant. Used by strategies 1-3 below to award a historical bonus without
    // issuing one COUNT query per candidate.
    const approvedMatches = await this.matchRepository.find({
      where: { tenant: { id: tenantId }, status: MatchStatus.APPROVED },
      select: ['id'],
      relations: ['contact'],
    });
    const approvedContactIds = new Set(
      approvedMatches.filter((m) => m.contact?.id).map((m) => m.contact.id),
    );
    const hasHistoricalMatch = (contactId: number) =>
      approvedContactIds.has(contactId);

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
        const historical = hasHistoricalMatch(paymentMethod.contact.id);
        return {
          contact: paymentMethod.contact,
          confidenceScore: historical ? 100 : 95,
          matchCriteria: {
            method: 'payment_method_phone',
            matchedValue: transaction.senderPhoneNormalized,
            historicalBonus: historical,
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
        const historical = hasHistoricalMatch(phone.contact.id);
        return {
          contact: phone.contact,
          confidenceScore: historical ? 100 : 90,
          matchCriteria: {
            method: 'contact_phone',
            matchedValue: transaction.senderPhoneNormalized,
            historicalBonus: historical,
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
            const historical = hasHistoricalMatch(p.contact.id);
            return {
              contact: p.contact,
              confidenceScore: historical ? 100 : 90,
              matchCriteria: {
                method: 'contact_phone_normalized',
                matchedValue: normalizedPhone,
                historicalBonus: historical,
              },
            };
          }
        }
      }
    }

    // Strategy 3: Fuzzy name match (60-85% confidence based on similarity).
    // Capped at 500 contacts so a dialog open is bounded — the batch runMatching
    // path is the right place for exhaustive scanning.
    if (transaction.senderName) {
      const contacts = await this.contactRepository.find({
        where: { tenant: { id: tenantId } },
        relations: ['person'],
        take: 500,
      });

      let bestMatch: MatchCandidate | null = null;

      for (const contact of contacts) {
        if (!contact.person) continue;

        const fullName = `${contact.person.firstName || ''} ${
          contact.person.middleName || ''
        } ${contact.person.lastName || ''}`.trim();
        const similarity = calculateNameSimilarity(
          transaction.senderName,
          fullName,
        );

        if (similarity >= 0.6) {
          const baseConfidence = Math.round(60 + similarity * 25);
          const historical = hasHistoricalMatch(contact.id);
          const confidenceScore = historical
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
                historicalBonus: historical,
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

        if (
          matchResult &&
          matchResult.confidenceScore >= minConfidenceThreshold
        ) {
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
