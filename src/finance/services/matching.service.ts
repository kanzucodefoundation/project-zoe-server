import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ContactPaymentMethod from '../entities/contact-payment-method.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Contact from '../../crm/entities/contact.entity';
import { MatchType } from '../enums/match-type.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { getPersonFullName } from '../../crm/crm.helpers';
import { GroupPermissionsService } from '../../groups/services/group-permissions.service';
import { extractPersonName, extractTitheNumber } from '../statement-parsing';
import { resolveTransactionCategory } from '../enums/transaction-category.enum';
import { CategoryRoutingService } from './category-routing.service';
import { MatchSuggestionDto } from '../dto/reconciliation.dto';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';
import {
  normalizePhone,
  calculateNameSimilarity,
  normalizeTitheNumber,
} from '../finance.helpers';
import { ReconciliationPluginRegistry } from '../plugins/reconciliation-plugin.registry';
import {
  IReconciliationPlugin,
  MatchResult,
} from '../interfaces/reconciliation-plugin.interface';

interface ContactIndex {
  contacts: Contact[];
  byTitheNumber: Map<string, Contact>;
  byPhone: Map<string, Contact>;
  approvedContactIds: Set<number>;
}

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
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
    private pluginRegistry: ReconciliationPluginRegistry,
    private categoryRoutingService: CategoryRoutingService,
    private groupPermissionsService: GroupPermissionsService,
  ) {
    this.transactionRepository = connection.getRepository(Transaction);
    this.matchRepository = connection.getRepository(ReconciliationMatch);
    this.paymentMethodRepository =
      connection.getRepository(ContactPaymentMethod);
    this.contactRepository = connection.getRepository(Contact);
    this.logger = this.appLogger.createContextLogger('MatchingService');
  }

  /**
   * Human-readable labels for the internal match methods, so the reconciliation
   * screen can explain *why* a contact was suggested rather than showing a
   * bare identifier like "contact_phone_normalized".
   */
  private static readonly MATCH_METHOD_LABELS: Record<string, string> = {
    tithe_number: 'Tithe number',
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

    // Reconciliation is ultimately about attributing the gift to a campus and
    // FOB, so show the reviewer where this contact posts to before they accept
    // the match rather than making them discover it at posting time.
    const attribution =
      await this.groupPermissionsService.resolveAttributionForContact(
        contact.id,
      );

    return [
      {
        contact: {
          id: contact.id,
          name: getPersonFullName(contact.person) || `Contact ${contact.id}`,
          phone: contact.phones?.[0]?.value ?? undefined,
          location: attribution.location?.name,
          fob: attribution.fob?.name,
          attributionIsFallback:
            attribution.locationIsFallback || attribution.fobIsFallback,
        },
        confidenceScore: candidate.confidenceScore,
        matchReasons,
      },
    ];
  }

  /**
   * The tenant's contacts, indexed for matching.
   *
   * Built once and reused for a whole sweep: the strategies below need the full
   * roster, and reloading it per transaction both capped matching at an
   * arbitrary slice of contacts and turned one sweep into one full scan per row.
   */
  private async buildContactIndex(tenantId: number): Promise<ContactIndex> {
    const [contacts, approvedMatches] = await Promise.all([
      this.contactRepository.find({
        where: { tenant: { id: tenantId } },
        relations: ['person', 'phones'],
      }),
      this.matchRepository.find({
        where: { tenant: { id: tenantId }, status: MatchStatus.APPROVED },
        select: ['id'],
        relations: ['contact'],
      }),
    ]);

    const byTitheNumber = new Map<string, Contact>();
    const byPhone = new Map<string, Contact>();

    for (const contact of contacts) {
      const titheNumber = normalizeTitheNumber(contact.titheNumber);
      if (titheNumber && !byTitheNumber.has(titheNumber)) {
        byTitheNumber.set(titheNumber, contact);
      }

      for (const phone of contact.phones ?? []) {
        const normalized = normalizePhone(phone.value);
        if (normalized && !byPhone.has(normalized)) {
          byPhone.set(normalized, contact);
        }
      }
    }

    return {
      contacts,
      byTitheNumber,
      byPhone,
      approvedContactIds: new Set(
        approvedMatches.filter((m) => m.contact?.id).map((m) => m.contact.id),
      ),
    };
  }

  private titheNumberOf(transaction: Transaction): string | null {
    return normalizeTitheNumber(
      transaction.rawData?.titheNumber ??
        extractTitheNumber(transaction.narration),
    );
  }

  async findMatchForTransaction(
    transaction: Transaction,
    pluginId?: string,
    index?: ContactIndex,
  ): Promise<MatchCandidate | null> {
    const tenantId = this.tenantContext.requireTenant();
    const contactIndex = index ?? (await this.buildContactIndex(tenantId));
    const hasHistoricalMatch = (contactId: number) =>
      contactIndex.approvedContactIds.has(contactId);

    // Try plugin custom matching first if available
    const plugin = pluginId
      ? this.pluginRegistry.get(pluginId)
      : this.pluginRegistry.getDefault();

    if (plugin?.customMatchLogic) {
      const pluginResult = await plugin.customMatchLogic(
        transaction,
        contactIndex.contacts,
      );
      if (pluginResult) {
        return {
          contact: pluginResult.contact,
          confidenceScore: pluginResult.confidenceScore,
          matchCriteria: pluginResult.matchCriteria,
        };
      }
    }

    // Strategy 0: tithe number from the message (98% confidence). Compared in
    // normalised form, so "TBG-9088" on a statement still finds "tbg9088".
    const titheNumber = this.titheNumberOf(transaction);
    if (titheNumber) {
      const contact = contactIndex.byTitheNumber.get(titheNumber);
      if (contact) {
        const historical = hasHistoricalMatch(contact.id);
        return {
          contact,
          confidenceScore: historical ? 100 : 98,
          matchCriteria: {
            method: 'tithe_number',
            matchedValue: titheNumber,
            historicalBonus: historical,
          },
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

    // Strategy 2: Phone match via Contact.phones (90% confidence). Both the
    // stored normalised value and the raw sender number are tried, because
    // statements and contact records were normalised at different times.
    for (const candidate of [
      transaction.senderPhoneNormalized,
      transaction.senderPhone,
    ]) {
      const normalized = normalizePhone(candidate);
      const contact = normalized
        ? contactIndex.byPhone.get(normalized)
        : undefined;

      if (contact) {
        const historical = hasHistoricalMatch(contact.id);
        return {
          contact,
          confidenceScore: historical ? 100 : 90,
          matchCriteria: {
            method: 'contact_phone',
            matchedValue: normalized as string,
            historicalBonus: historical,
          },
        };
      }
    }

    // Strategy 3: Fuzzy name match (60-85% confidence based on similarity).
    // The name typed into the message is tried first: givers regularly send on
    // someone else's phone, so the account holder is not always the giver. It
    // falls back to the statement's own name when it matches nobody, because
    // the extractor reads any two plain words as a name.
    const namesToTry = [
      extractPersonName(transaction.narration),
      transaction.senderName,
    ].filter((name): name is string => !!name);

    if (namesToTry.length > 0) {
      const contacts = contactIndex.contacts;

      for (const nameToMatch of namesToTry) {
        let bestMatch: MatchCandidate | null = null;
        let tiedCount = 0;

        for (const contact of contacts) {
          if (!contact.person) continue;

          const fullName = `${contact.person.firstName || ''} ${
            contact.person.middleName || ''
          } ${contact.person.lastName || ''}`.trim();
          const similarity = calculateNameSimilarity(nameToMatch, fullName);

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
              tiedCount = 1;
            } else if (confidenceScore === bestMatch.confidenceScore) {
              tiedCount += 1;
            }
          }
        }

        // Two contacts the name fits equally well is not a match, it is a
        // question for a person. Common names tie constantly across a roster
        // of thousands, and taking the first would attribute the gift by load
        // order.
        if (bestMatch && tiedCount > 1) {
          this.logger.business('log', 'Ambiguous name match skipped', {
            operation: 'findMatchForTransaction',
            resource: 'transaction',
            metadata: {
              transactionId: transaction.id,
              name: nameToMatch,
              candidates: tiedCount,
            },
          });
          continue;
        }

        if (bestMatch) {
          return bestMatch;
        }
      }
    }

    return null;
  }

  async runMatching(
    accountId: number | undefined,
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

    // Filtering on `account: { id: undefined }` matches nothing, so the account
    // clause is only added when an account was actually chosen.
    const where: any = {
      tenant: { id: tenantId },
      status: 'PENDING' as any,
    };
    if (accountId) {
      where.account = { id: accountId };
    }

    const allPending = await this.transactionRepository.find({
      where,
      relations: ['account'],
    });

    // Offertory has no giver to find, so it is left out of the sweep entirely.
    const categoriesInSweep = [
      ...new Set(
        allPending.map((txn) => resolveTransactionCategory(txn.category)),
      ),
    ];
    const currencyRouted = new Set(
      categoriesInSweep.filter((category) =>
        this.categoryRoutingService.isCurrencyRouted(category),
      ),
    );

    const transactions = allPending.filter(
      (txn) => !currencyRouted.has(resolveTransactionCategory(txn.category)),
    );

    const skipped = allPending.length - transactions.length;
    if (skipped > 0) {
      this.logger.business(
        'log',
        'Skipped categories with a standing customer',
        {
          operation: 'runMatching',
          metadata: { skipped, categories: [...currencyRouted] },
        },
      );
    }

    let processed = 0;
    let matched = 0;
    let autoApproved = 0;
    const errors: string[] = [];

    const contactIndex = await this.buildContactIndex(tenantId);

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
          contactIndex,
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
            // Everything below the auto-approve threshold waits for a human.
            match.status = MatchStatus.PENDING;
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
