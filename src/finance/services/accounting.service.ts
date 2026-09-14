import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Contact from '../../crm/entities/contact.entity';
import FinancialAccount from '../entities/financial-account.entity';
import { MatchStatus } from '../enums/match-status.enum';
import { resolveTransactionCategory } from '../enums/transaction-category.enum';
import {
  QBO_DEFAULT_CLASS_NAME,
  QBO_DEFAULT_LOCATION_NAME,
} from '../constants/accounting-mapping.constants';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';
import { GroupPermissionsService } from '../../groups/services/group-permissions.service';
import { QuickBooksService } from '../../integrations/quickbooks/quickbooks.service';
import { WorshipHarvestAccountingPlugin } from '../plugins/worship-harvest-accounting.plugin';
import {
  AccountingPosting,
  AccountingPostingStatus,
  AccountingPostingSystem,
  AccountingPostingDocumentType,
} from '../../integrations/quickbooks/entities/accounting-posting.entity';
import { AccountingSalesReceipt } from '../interfaces/accounting-plugin.interface';
import {
  QboCustomer,
  QboErrorBody,
  QboNamedEntity,
} from '../../integrations/quickbooks/quickbooks.types';
import { getPersonFullName } from '../../crm/crm.helpers';
import {
  ApplySetupDto,
  CreateQboCustomerDto,
  SetupMappingDto,
} from '../dto/accounting-setup.dto';

export { ApplySetupDto, CreateQboCustomerDto, SetupMappingDto };

export interface PreflightBlocker {
  code: string;
  message: string;
}

export interface PreflightResult {
  ready: boolean;
  blockers: PreflightBlocker[];
}

export interface QboOption {
  id: string;
  name: string;
}

export interface MissingMappingItem {
  code: string;
  internalReferenceType: string;
  internalReferenceId: string | number;
  internalName: string;
  externalReferenceType: string;
  qboOptions: QboOption[];
  /**
   * True when the operator may provision the QBO record from inside Zoe instead
   * of picking an existing one. Only CONTACT -> CUSTOMER is creatable: items,
   * accounts, classes and locations are chart-of-accounts decisions that belong
   * to whoever owns the books.
   */
  creatable: boolean;
  /** Pre-filled form values for the "create in QuickBooks" path. */
  createDefaults?: CustomerCreateDefaults;
  /** Best-guess existing QBO record, pre-selected in the UI. */
  suggestedOptionId?: string | null;
  /** Why that option was suggested, e.g. "name matches" — shown as a hint. */
  suggestionReason?: string | null;
}

export interface CustomerCreateDefaults {
  displayName: string;
  givenName?: string;
  familyName?: string;
  primaryPhone?: string;
  primaryEmail?: string;
}

export interface DataIssue {
  code: string;
  message: string;
  contactId?: number;
}

export interface BatchPostItemResult {
  transactionId: number;
  status: 'POSTED' | 'FAILED';
  /**
   * Who the gift is from, in words. Finance staff do not recognise transaction
   * ids, so a failure has to name the giver to be actionable.
   */
  giver: string;
  amount: number;
  transactionDate: string;
  externalDocumentNumber?: string | null;
  externalDocumentId?: string | null;
  error?: string;
}

export interface BatchPostResult {
  posted: number;
  failed: number;
  results: BatchPostItemResult[];
}

export interface SetupResult {
  ready: boolean;
  contact?: { id: number; name: string };
  missingMappings: MissingMappingItem[];
  dataIssues: DataIssue[];
}

const SYSTEM = 'QUICKBOOKS';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    @InjectRepository(ReconciliationMatch)
    private readonly matchRepo: Repository<ReconciliationMatch>,
    @InjectRepository(AccountingPosting)
    private readonly postingRepo: Repository<AccountingPosting>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(FinancialAccount)
    private readonly accountRepo: Repository<FinancialAccount>,
    private readonly tenantContext: TenantContext,
    private readonly mappingService: ExternalSystemMappingService,
    private readonly groupPermissionsService: GroupPermissionsService,
    private readonly qbService: QuickBooksService,
    private readonly accountingPlugin: WorshipHarvestAccountingPlugin,
  ) {}

  private async getTransaction(transactionId: number): Promise<Transaction> {
    const tenantId = this.tenantContext.requireTenant();
    const txn = await this.txnRepo.findOne({
      where: { id: transactionId, tenant: { id: tenantId } },
      relations: ['account'],
    });
    if (!txn)
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    return txn;
  }

  private async getApprovedMatch(
    transactionId: number,
  ): Promise<ReconciliationMatch | null> {
    const tenantId = this.tenantContext.requireTenant();
    return this.matchRepo.findOne({
      where: {
        transaction: { id: transactionId },
        tenant: { id: tenantId },
        status: MatchStatus.APPROVED,
      },
      relations: ['contact'],
      order: { approvedAt: 'DESC' },
    });
  }

  async preflight(transactionId: number): Promise<PreflightResult> {
    const tenantId = this.tenantContext.requireTenant();
    const blockers: PreflightBlocker[] = [];

    const txn = await this.getTransaction(transactionId);

    // Already successfully posted?
    const existing = await this.postingRepo.findOne({
      where: {
        transactionId,
        tenantId,
        status: AccountingPostingStatus.POSTED,
      },
    });
    if (existing) {
      blockers.push({
        code: 'ALREADY_POSTED',
        message: `Already posted to QuickBooks (doc ${
          existing.externalDocumentNumber ?? existing.externalDocumentId
        })`,
      });
      return { ready: false, blockers };
    }

    // QBO connected?
    const connection = await this.qbService.getConnection(tenantId);
    if (!connection) {
      blockers.push({
        code: 'QUICKBOOKS_NOT_CONNECTED',
        message: 'QuickBooks is not connected',
      });
    }

    // Approved match with a contact?
    const match = await this.getApprovedMatch(transactionId);
    if (!match?.contact) {
      blockers.push({
        code: 'MATCH_NOT_APPROVED',
        message: 'Transaction must have an approved contact match',
      });
      return { ready: blockers.length === 0, blockers };
    }

    const contactId = match.contact.id;

    // QBO Customer mapping?
    const customerMap = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'CONTACT',
      internalReferenceId: contactId,
      externalReferenceType: 'CUSTOMER',
    });
    if (!customerMap) {
      blockers.push({
        code: 'CUSTOMER_MAPPING_MISSING',
        message: `No QuickBooks Customer mapped for contact ${contactId}`,
      });
    }

    // Category → Item mapping?
    const categoryKey = resolveTransactionCategory(txn.category);
    const itemMap = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'GIVING_CATEGORY',
      internalReferenceId: categoryKey,
      externalReferenceType: 'ITEM',
    });
    if (!itemMap) {
      blockers.push({
        code: 'ITEM_MAPPING_MISSING',
        message: `No QuickBooks Item mapped for category ${categoryKey}`,
      });
    }

    // FinancialAccount → QBO Account?
    const accountId = txn.account?.id ?? (txn as any).accountId;
    const accountMap = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'FINANCIAL_ACCOUNT',
      internalReferenceId: accountId,
      externalReferenceType: 'ACCOUNT',
    });
    if (!accountMap) {
      blockers.push({
        code: 'ACCOUNT_MAPPING_MISSING',
        message: `No QuickBooks Account mapped for financial account ${accountId}`,
      });
    }

    // Location and FOB — a giver who is in neither is attributed to the mother
    // group rather than blocked, so both are ordinary GROUP mappings from here.
    const { location, fob } =
      await this.groupPermissionsService.resolveAttributionForContact(
        contactId,
      );
    if (!location) {
      blockers.push({
        code: 'LOCATION_MISSING',
        message:
          'Could not resolve a Location group, and this tenant has no root group to fall back to',
      });
    } else {
      const locMap = await this.mappingService.lookupByInternal({
        system: SYSTEM,
        internalReferenceType: 'GROUP',
        internalReferenceId: location.id,
        externalReferenceType: 'LOCATION',
      });
      if (!locMap) {
        blockers.push({
          code: 'LOCATION_MAPPING_MISSING',
          message: `No QuickBooks Location mapped for group ${location.name}`,
        });
      }
    }

    if (!fob) {
      blockers.push({
        code: 'FOB_MISSING',
        message:
          'Could not resolve a FOB group, and this tenant has no root group to fall back to',
      });
    } else {
      const fobMap = await this.mappingService.lookupByInternal({
        system: SYSTEM,
        internalReferenceType: 'GROUP',
        internalReferenceId: fob.id,
        externalReferenceType: 'CLASS',
      });
      if (!fobMap) {
        blockers.push({
          code: 'CLASS_MAPPING_MISSING',
          message: `No QuickBooks Class mapped for FOB ${fob.name}`,
        });
      }
    }

    // Valid amount?
    if (!txn.amount || Number(txn.amount) <= 0) {
      blockers.push({
        code: 'INVALID_AMOUNT',
        message: 'Transaction amount must be greater than zero',
      });
    }

    return { ready: blockers.length === 0, blockers };
  }

  async preview(transactionId: number): Promise<AccountingSalesReceipt> {
    const { ready, blockers } = await this.preflight(transactionId);
    if (!ready) {
      throw new BadRequestException({
        message: 'Transaction is not ready to post',
        blockers,
      });
    }
    const txn = await this.getTransaction(transactionId);
    const match = await this.getApprovedMatch(transactionId);
    return this.accountingPlugin.buildSalesReceipt(txn, match);
  }

  async post(
    transactionId: number,
    requestedById: number,
  ): Promise<AccountingPosting> {
    const tenantId = this.tenantContext.requireTenant();

    const { ready, blockers } = await this.preflight(transactionId);
    if (!ready) {
      throw new BadRequestException({
        message: 'Transaction is not ready to post',
        blockers,
      });
    }

    const txn = await this.getTransaction(transactionId);
    const match = await this.getApprovedMatch(transactionId);
    const receipt = await this.accountingPlugin.buildSalesReceipt(txn, match);

    const posting = this.postingRepo.create({
      tenantId,
      transactionId,
      system: AccountingPostingSystem.QUICKBOOKS,
      documentType: AccountingPostingDocumentType.SALES_RECEIPT,
      status: AccountingPostingStatus.PENDING,
      requestedById,
      requestedAt: new Date(),
    });
    await this.postingRepo.save(posting);

    try {
      const qboPayload = this.toQboSalesReceiptPayload(receipt);
      const qboResponse = await this.qbService.postSalesReceipt(
        tenantId,
        qboPayload,
      );

      posting.status = AccountingPostingStatus.POSTED;
      posting.externalDocumentId = qboResponse?.Id ?? null;
      posting.externalDocumentNumber = qboResponse?.DocNumber ?? null;
      posting.postedAt = new Date();
    } catch (err) {
      posting.status = AccountingPostingStatus.FAILED;
      posting.errorMessage = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err.message;
    }

    return this.postingRepo.save(posting);
  }

  /**
   * Posts several approved transactions in one call.
   *
   * Runs one at a time rather than in parallel: QuickBooks rate-limits per
   * realm, and a partial failure must not leave the caller unable to tell which
   * receipts were written. Every transaction reports its own outcome, and one
   * failure never stops the rest.
   */
  async postMany(
    transactionIds: number[],
    requestedById: number,
  ): Promise<BatchPostResult> {
    const results: BatchPostItemResult[] = [];

    for (const transactionId of transactionIds) {
      // Every transaction is attempted on its own terms. One rejected receipt
      // must never stop the queue, so nothing in here is allowed to throw.
      const identity = await this.describeTransaction(transactionId);

      try {
        const posting = await this.post(transactionId, requestedById);
        results.push(
          posting.status === AccountingPostingStatus.POSTED
            ? {
                ...identity,
                status: 'POSTED',
                externalDocumentNumber: posting.externalDocumentNumber,
                externalDocumentId: posting.externalDocumentId,
              }
            : {
                ...identity,
                status: 'FAILED',
                error: this.readableQboError(posting.errorMessage),
              },
        );
      } catch (err) {
        // A transaction that is not ready throws instead of saving a posting;
        // record why and carry on with the rest.
        results.push({
          ...identity,
          status: 'FAILED',
          error: this.readableSetupError(err),
        });
      }
    }

    return {
      posted: results.filter((r) => r.status === 'POSTED').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      results,
    };
  }

  /**
   * Identifies a transaction the way finance would: by who sent the money and
   * how much, falling back to the name on the statement when no contact has
   * been matched yet.
   */
  private async describeTransaction(transactionId: number): Promise<{
    transactionId: number;
    giver: string;
    amount: number;
    transactionDate: string;
  }> {
    let giver = `Transaction ${transactionId}`;
    let amount = 0;
    let transactionDate = '';

    try {
      const txn = await this.getTransaction(transactionId);
      amount = Number(txn.amount) || 0;
      transactionDate =
        txn.transactionDate instanceof Date
          ? txn.transactionDate.toISOString().slice(0, 10)
          : String(txn.transactionDate ?? '');

      const match = await this.getApprovedMatch(transactionId);
      if (match?.contact) {
        const contact = await this.contactRepo.findOne({
          where: { id: match.contact.id },
          relations: ['person'],
        });
        const name = contact ? getPersonFullName(contact.person) : '';
        if (name) giver = name;
      }

      if (giver === `Transaction ${transactionId}` && txn.senderName) {
        giver = txn.senderName;
      }
    } catch {
      // Describing a row is a courtesy; never let it fail the posting run.
    }

    return { transactionId, giver, amount, transactionDate };
  }

  /** Turns QuickBooks' JSON fault payload into a sentence. */
  private readableQboError(raw?: string | null): string {
    if (!raw) return 'QuickBooks rejected the receipt';
    try {
      const parsed = JSON.parse(raw);
      const faults = (parsed as QboErrorBody)?.Fault?.Error ?? [];
      const detail = faults
        .map((f) => f?.Detail ?? f?.Message)
        .filter(Boolean)
        .join('; ');
      return detail || raw;
    } catch {
      return raw;
    }
  }

  /** Explains a not-ready transaction using its preflight blockers. */
  private readableSetupError(err: unknown): string {
    const response = (
      err as {
        response?: {
          blockers?: PreflightBlocker[];
          message?: { blockers?: PreflightBlocker[] };
        };
      }
    )?.response;
    const blockers = response?.blockers ?? response?.message?.blockers;
    if (Array.isArray(blockers) && blockers.length > 0) {
      return blockers.map((b) => b.message).join('; ');
    }
    return (err as Error)?.message ?? 'Could not post';
  }

  async getSetup(transactionId: number): Promise<SetupResult> {
    const tenantId = this.tenantContext.requireTenant();
    const missingMappings: MissingMappingItem[] = [];
    const dataIssues: DataIssue[] = [];

    const txn = await this.getTransaction(transactionId);

    const existing = await this.postingRepo.findOne({
      where: {
        transactionId,
        tenantId,
        status: AccountingPostingStatus.POSTED,
      },
    });
    if (existing) {
      return {
        ready: false,
        missingMappings: [],
        dataIssues: [
          {
            code: 'ALREADY_POSTED',
            message: `Already posted (${
              existing.externalDocumentNumber ?? existing.externalDocumentId
            })`,
          },
        ],
      };
    }

    const connection = await this.qbService.getConnection(tenantId);
    if (!connection) {
      return {
        ready: false,
        missingMappings: [],
        dataIssues: [
          {
            code: 'QUICKBOOKS_NOT_CONNECTED',
            message: 'QuickBooks is not connected',
          },
        ],
      };
    }

    const match = await this.getApprovedMatch(transactionId);
    if (!match?.contact) {
      return {
        ready: false,
        missingMappings: [],
        dataIssues: [
          {
            code: 'MATCH_NOT_APPROVED',
            message: 'Transaction must have an approved contact match',
          },
        ],
      };
    }

    const contactId = match.contact.id;
    const categoryKey = resolveTransactionCategory(txn.category);
    const accountId = txn.account?.id ?? (txn as any).accountId;

    const [
      contact,
      account,
      customerMap,
      itemMap,
      accountMap,
      attribution,
    ] = await Promise.all([
      this.contactRepo.findOne({
        where: { id: contactId, tenantId },
        relations: ['person', 'phones', 'emails'],
      }),
      this.accountRepo.findOne({ where: { id: accountId } }),
      this.mappingService.lookupByInternal({
        system: SYSTEM,
        internalReferenceType: 'CONTACT',
        internalReferenceId: contactId,
        externalReferenceType: 'CUSTOMER',
      }),
      this.mappingService.lookupByInternal({
        system: SYSTEM,
        internalReferenceType: 'GIVING_CATEGORY',
        internalReferenceId: categoryKey,
        externalReferenceType: 'ITEM',
      }),
      this.mappingService.lookupByInternal({
        system: SYSTEM,
        internalReferenceType: 'FINANCIAL_ACCOUNT',
        internalReferenceId: accountId,
        externalReferenceType: 'ACCOUNT',
      }),
      this.groupPermissionsService.resolveAttributionForContact(contactId),
    ]);
    const { location, fob, locationIsFallback, fobIsFallback } = attribution;

    const [locationMap, fobMap] = await Promise.all([
      location
        ? this.mappingService.lookupByInternal({
            system: SYSTEM,
            internalReferenceType: 'GROUP',
            internalReferenceId: location.id,
            externalReferenceType: 'LOCATION',
          })
        : Promise.resolve(null),
      fob
        ? this.mappingService.lookupByInternal({
            system: SYSTEM,
            internalReferenceType: 'GROUP',
            internalReferenceId: fob.id,
            externalReferenceType: 'CLASS',
          })
        : Promise.resolve(null),
    ]);

    const needDepartments = !!location && !locationMap;
    const needClasses = !!fob && !fobMap;

    // Each reference list is fetched defensively: a company with Class or
    // Location tracking switched off makes those queries fail, and that must
    // degrade to an explained warning rather than a 500 for the whole dialog.
    const [customers, items, accounts, departments, classes] =
      await Promise.all([
        !customerMap
          ? this.tryQbo<QboCustomer>(() =>
              this.qbService.getQboCustomers(tenantId),
            )
          : this.emptyQbo<QboCustomer>(),
        !itemMap
          ? this.tryQbo<QboNamedEntity>(() =>
              this.qbService.getQboItems(tenantId),
            )
          : this.emptyQbo<QboNamedEntity>(),
        !accountMap
          ? this.tryQbo<QboNamedEntity>(() =>
              this.qbService.getQboAccounts(tenantId),
            )
          : this.emptyQbo<QboNamedEntity>(),
        needDepartments
          ? this.tryQbo<QboNamedEntity>(() =>
              this.qbService.getQboDepartments(tenantId),
            )
          : this.emptyQbo<QboNamedEntity>(),
        needClasses
          ? this.tryQbo<QboNamedEntity>(() =>
              this.qbService.getQboClasses(tenantId),
            )
          : this.emptyQbo<QboNamedEntity>(),
      ]);

    const contactName = contact
      ? getPersonFullName(contact.person) || `Contact ${contactId}`
      : `Contact ${contactId}`;

    if (!customerMap) {
      const customerOptions: QboOption[] = customers.data.map((c) => ({
        id: String(c.Id),
        name: c.DisplayName ?? c.FullyQualifiedName ?? c.CompanyName ?? c.Id,
      }));
      const createDefaults = this.buildCustomerDefaults(
        contact,
        contactName,
        txn,
      );
      const suggestion = this.suggestCustomer(
        customers.data,
        contactName,
        createDefaults.primaryPhone,
      );

      missingMappings.push({
        code: 'CUSTOMER_MAPPING_MISSING',
        internalReferenceType: 'CONTACT',
        internalReferenceId: contactId,
        internalName: contactName,
        externalReferenceType: 'CUSTOMER',
        qboOptions: customerOptions,
        creatable: true,
        createDefaults,
        suggestedOptionId: suggestion.id,
        suggestionReason: suggestion.reason,
      });

      if (customers.failed) {
        dataIssues.push({
          code: 'QBO_CUSTOMERS_UNAVAILABLE',
          message:
            'QuickBooks customers could not be loaded, so there is nothing to pick from. You can still create this giver as a new customer.',
        });
      }
    }

    if (!itemMap) {
      missingMappings.push({
        code: 'ITEM_MAPPING_MISSING',
        internalReferenceType: 'GIVING_CATEGORY',
        internalReferenceId: categoryKey,
        internalName: categoryKey,
        externalReferenceType: 'ITEM',
        qboOptions: items.data.map((i) => ({
          id: String(i.Id),
          name: i.Name,
        })),
        creatable: false,
      });
      if (items.failed) {
        dataIssues.push({
          code: 'QBO_ITEMS_UNAVAILABLE',
          message:
            'QuickBooks products and services could not be loaded. Check the QuickBooks connection and try again.',
        });
      }
    }

    if (!accountMap) {
      missingMappings.push({
        code: 'ACCOUNT_MAPPING_MISSING',
        internalReferenceType: 'FINANCIAL_ACCOUNT',
        internalReferenceId: accountId,
        internalName: account?.name ?? `Account ${accountId}`,
        externalReferenceType: 'ACCOUNT',
        qboOptions: accounts.data.map((a) => ({
          id: String(a.Id),
          name: a.Name,
        })),
        creatable: false,
      });
      if (accounts.failed) {
        dataIssues.push({
          code: 'QBO_ACCOUNTS_UNAVAILABLE',
          message:
            'The QuickBooks chart of accounts could not be loaded. Check the QuickBooks connection and try again.',
        });
      }
    }

    const departmentOptions: QboOption[] = departments.data.map((d) => ({
      id: String(d.Id),
      name: d.Name,
    }));
    const classOptions: QboOption[] = classes.data.map((c) => ({
      id: String(c.Id),
      name: c.Name,
    }));

    if (!location) {
      dataIssues.push({
        code: 'LOCATION_MISSING',
        message:
          'This contact has no Location group and the tenant has no root group to fall back to. Create the mother group in the CRM, then re-check.',
        contactId,
      });
    } else if (!locationMap) {
      // When the giver has no campus this row is the mother group, so suggest
      // the catch-all QuickBooks location rather than an exact name match.
      missingMappings.push({
        code: locationIsFallback
          ? 'DEFAULT_LOCATION_MAPPING_MISSING'
          : 'LOCATION_MAPPING_MISSING',
        internalReferenceType: 'GROUP',
        internalReferenceId: location.id,
        internalName: location.name,
        externalReferenceType: 'LOCATION',
        qboOptions: departmentOptions,
        creatable: false,
        suggestedOptionId: this.suggestByName(
          departmentOptions,
          locationIsFallback ? QBO_DEFAULT_LOCATION_NAME : location.name,
        ),
        suggestionReason: locationIsFallback
          ? `“${QBO_DEFAULT_LOCATION_NAME}” is the catch-all location in QuickBooks`
          : 'the name matches exactly',
      });
    }

    if (needDepartments && departments.failed) {
      dataIssues.push({
        code: 'QBO_LOCATIONS_UNAVAILABLE',
        message:
          'QuickBooks locations could not be loaded. Turn on location tracking in QuickBooks (Settings → Account and settings → Advanced), then re-check.',
      });
    }

    if (!fob) {
      dataIssues.push({
        code: 'FOB_MISSING',
        message:
          'This contact has no FOB group and the tenant has no root group to fall back to. Create the mother group in the CRM, then re-check.',
        contactId,
      });
    } else if (!fobMap) {
      missingMappings.push({
        code: fobIsFallback
          ? 'DEFAULT_CLASS_MAPPING_MISSING'
          : 'CLASS_MAPPING_MISSING',
        internalReferenceType: 'GROUP',
        internalReferenceId: fob.id,
        internalName: fob.name,
        externalReferenceType: 'CLASS',
        qboOptions: classOptions,
        creatable: false,
        suggestedOptionId: this.suggestByName(
          classOptions,
          fobIsFallback ? QBO_DEFAULT_CLASS_NAME : fob.name,
        ),
        suggestionReason: fobIsFallback
          ? `“${QBO_DEFAULT_CLASS_NAME}” is the catch-all class in QuickBooks`
          : 'the name matches exactly',
      });
    }

    if (needClasses && classes.failed) {
      dataIssues.push({
        code: 'QBO_CLASSES_UNAVAILABLE',
        message:
          'QuickBooks classes could not be loaded. Turn on class tracking in QuickBooks (Settings → Account and settings → Advanced), then re-check.',
      });
    }

    // preflight() also rejects non-positive amounts. Surface it here too, so
    // `ready` never disagrees with what /preview and /post will accept.
    if (!txn.amount || Number(txn.amount) <= 0) {
      dataIssues.push({
        code: 'INVALID_AMOUNT',
        message: 'Transaction amount must be greater than zero.',
      });
    }

    return {
      ready: missingMappings.length === 0 && dataIssues.length === 0,
      contact: { id: contactId, name: contactName },
      missingMappings,
      dataIssues,
    };
  }

  // ── Setup helpers ───────────────────────────────────────────────────

  /** Exact, case-insensitive name match against a QBO option list. */
  private suggestByName(options: QboOption[], name: string): string | null {
    const target = this.normalizeName(name);
    if (!target) return null;
    return (
      options.find((o) => this.normalizeName(o.name) === target)?.id ?? null
    );
  }

  private emptyQbo<T>(): Promise<{ data: T[]; failed: boolean }> {
    return Promise.resolve({ data: [], failed: false });
  }

  private async tryQbo<T>(
    fetch: () => Promise<T[]>,
  ): Promise<{ data: T[]; failed: boolean }> {
    try {
      return { data: await fetch(), failed: false };
    } catch (err) {
      this.logger.warn(
        `QuickBooks reference lookup failed: ${
          err?.response?.data ? JSON.stringify(err.response.data) : err?.message
        }`,
      );
      return { data: [], failed: true };
    }
  }

  /** Lowercased, punctuation-free form used for fuzzy name comparison. */
  private normalizeName(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Last 9 digits, which is what makes MoMo numbers comparable across formats. */
  private normalizePhone(value?: string): string {
    const digits = (value ?? '').replace(/\D/g, '');
    return digits.length > 9 ? digits.slice(-9) : digits;
  }

  /**
   * Seeds the "create customer" form from the CRM contact, falling back to the
   * sender details captured on the MoMo statement line.
   */
  private buildCustomerDefaults(
    contact: Contact | null,
    contactName: string,
    txn: Transaction,
  ): CustomerCreateDefaults {
    const phones = contact?.phones ?? [];
    const emails = contact?.emails ?? [];
    const primaryPhone =
      phones.find((p) => p.isPrimary)?.value ??
      phones[0]?.value ??
      txn.senderPhone ??
      undefined;
    const primaryEmail =
      emails.find((e) => e.isPrimary)?.value ?? emails[0]?.value ?? undefined;

    const displayName =
      contactName && !contactName.startsWith('Contact ')
        ? contactName
        : (txn.senderName ?? contactName);

    return {
      // QBO caps DisplayName at 100 characters and requires it to be unique.
      displayName: displayName.slice(0, 100),
      givenName: contact?.person?.firstName?.slice(0, 25) || undefined,
      familyName: contact?.person?.lastName?.slice(0, 25) || undefined,
      primaryPhone: primaryPhone?.slice(0, 30),
      primaryEmail,
    };
  }

  /**
   * Picks the QBO customer most likely to already represent this contact, so
   * the operator confirms a suggestion instead of scanning a list of hundreds.
   */
  private suggestCustomer(
    customers: QboCustomer[],
    contactName: string,
    contactPhone?: string,
  ): { id: string | null; reason: string | null } {
    const targetName = this.normalizeName(contactName);
    const targetPhone = this.normalizePhone(contactPhone);

    let nameMatch: QboCustomer | null = null;
    for (const c of customers) {
      const candidateName = this.normalizeName(
        c.DisplayName ?? c.FullyQualifiedName ?? c.CompanyName ?? '',
      );
      if (targetPhone) {
        const candidatePhone = this.normalizePhone(
          c.PrimaryPhone?.FreeFormNumber ?? c.Mobile?.FreeFormNumber,
        );
        if (candidatePhone && candidatePhone === targetPhone) {
          return { id: String(c.Id), reason: 'phone number matches' };
        }
      }
      if (!nameMatch && targetName && candidateName === targetName) {
        nameMatch = c;
      }
    }

    return nameMatch
      ? { id: String(nameMatch.Id), reason: 'name matches exactly' }
      : { id: null, reason: null };
  }

  /**
   * The QuickBooks customer that stands for a contact's campus, creating it if
   * the church has not set one up yet.
   *
   * Givers are sub-customers of their campus, so every person created from Zoe
   * needs this parent to exist first. A contact with no campus resolves to the
   * mother group, which is the Central fallback.
   */
  private async ensureLocationCustomer(
    tenantId: number,
    contactId: number,
  ): Promise<{ id: string; name: string } | null> {
    const { location } =
      await this.groupPermissionsService.resolveAttributionForContact(
        contactId,
      );
    if (!location) return null;

    const existingMapping = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'GROUP',
      internalReferenceId: location.id,
      externalReferenceType: 'CUSTOMER',
    });
    if (existingMapping) {
      return {
        id: existingMapping.externalReferenceId,
        name: existingMapping.externalReferenceName ?? location.name,
      };
    }

    // Not mapped yet: adopt a same-named customer if the church already has
    // one, so re-running this never produces a duplicate campus.
    let customer = await this.qbService
      .findQboCustomerByDisplayName(tenantId, location.name)
      .catch(() => null);

    if (!customer) {
      customer = await this.qbService.createQboCustomer(tenantId, {
        DisplayName: location.name,
      });
      this.logger.log(
        `Created QuickBooks parent customer "${location.name}" for campus ${location.id}`,
      );
    }

    await this.mappingService.upsert({
      system: SYSTEM,
      internalReferenceType: 'GROUP',
      internalReferenceId: String(location.id),
      externalReferenceType: 'CUSTOMER',
      externalReferenceId: String(customer.Id),
      externalReferenceName: customer.DisplayName ?? location.name,
    });

    return {
      id: String(customer.Id),
      name: customer.DisplayName ?? location.name,
    };
  }

  /**
   * Creates the customer in QBO. A duplicate DisplayName (fault 6240) is not a
   * failure from the operator's point of view — it means the customer already
   * exists, so we link to it instead of making them start over.
   */
  private async createQboCustomer(
    tenantId: number,
    input: CreateQboCustomerDto,
    parent?: { id: string; name: string } | null,
  ): Promise<{ id: string; name: string }> {
    const payload: Record<string, any> = { DisplayName: input.displayName };
    if (parent) {
      // Sub-customer of the campus, which is how giving is grouped by location.
      payload.ParentRef = { value: parent.id };
      payload.Job = true;
    }
    if (input.givenName) payload.GivenName = input.givenName;
    if (input.familyName) payload.FamilyName = input.familyName;
    if (input.primaryPhone) {
      payload.PrimaryPhone = { FreeFormNumber: input.primaryPhone };
    }
    if (input.primaryEmail) {
      payload.PrimaryEmailAddr = { Address: input.primaryEmail };
    }

    try {
      const created = await this.qbService.createQboCustomer(tenantId, payload);
      return {
        id: String(created.Id),
        name: created.DisplayName ?? input.displayName,
      };
    } catch (err) {
      const body = (err as { response?: { data?: QboErrorBody } })?.response
        ?.data;
      const faults = body?.Fault?.Error ?? [];
      const isDuplicate = faults.some((f) => String(f?.code) === '6240');

      if (isDuplicate) {
        const existing = await this.qbService
          .findQboCustomerByDisplayName(tenantId, input.displayName)
          .catch(() => null);
        if (existing) {
          this.logger.log(
            `QuickBooks customer "${input.displayName}" already existed — linked to ${existing.Id}`,
          );
          return {
            id: String(existing.Id),
            name: existing.DisplayName ?? input.displayName,
          };
        }
        throw new BadRequestException(
          `A different QuickBooks customer already uses the name "${input.displayName}". Give this one a distinct display name, for example by adding a middle name or initial.`,
        );
      }

      const detail =
        faults[0]?.Detail ?? faults[0]?.Message ?? (err as Error)?.message;
      throw new BadRequestException(
        `QuickBooks rejected the new customer: ${detail}`,
      );
    }
  }

  /**
   * Persists the operator's choices. Returns a fresh SetupResult rather than a
   * bare preflight so the caller can re-render the dialog from one payload,
   * whether everything resolved or some rows still need attention.
   */
  async applySetup(
    transactionId: number,
    dto: ApplySetupDto,
  ): Promise<SetupResult> {
    const tenantId = this.tenantContext.requireTenant();

    for (const m of dto.mappings) {
      let externalReferenceId = m.externalReferenceId;
      let externalReferenceName = m.externalReferenceName;

      if (m.action === 'create') {
        if (m.externalReferenceType !== 'CUSTOMER') {
          throw new BadRequestException(
            `${m.externalReferenceType} records cannot be created from Zoe — add it in QuickBooks first, then pick it here.`,
          );
        }
        if (!m.create) {
          throw new BadRequestException(
            'Customer details are required when creating a new QuickBooks customer.',
          );
        }

        // Attach the giver to their campus in the same step. Doing this here
        // rather than asking for it separately is what keeps the dialog to one
        // decision per missing record.
        const parent =
          m.internalReferenceType === 'CONTACT'
            ? await this.ensureLocationCustomer(
                tenantId,
                Number(m.internalReferenceId),
              )
            : null;

        const created = await this.createQboCustomer(
          tenantId,
          m.create,
          parent,
        );
        externalReferenceId = created.id;
        externalReferenceName = created.name;
      }

      if (!externalReferenceId) {
        throw new BadRequestException(
          `No QuickBooks ${m.externalReferenceType} selected for ${m.internalReferenceType}.`,
        );
      }

      await this.mappingService.upsert({
        system: SYSTEM,
        internalReferenceType: m.internalReferenceType,
        internalReferenceId: String(m.internalReferenceId),
        externalReferenceType: m.externalReferenceType,
        externalReferenceId,
        externalReferenceName,
      });
    }

    return this.getSetup(transactionId);
  }

  async getPosting(transactionId: number): Promise<AccountingPosting | null> {
    const tenantId = this.tenantContext.requireTenant();
    return this.postingRepo.findOne({
      where: { transactionId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  private toQboSalesReceiptPayload(
    receipt: AccountingSalesReceipt,
  ): Record<string, any> {
    // Mappings are verified in preflight, but they can be removed in between.
    // Refuse rather than send a reference QuickBooks cannot resolve.
    const missing: string[] = [];
    if (!receipt.customer.externalCustomerId) missing.push('customer');
    if (!receipt.depositAccount.externalAccountId) missing.push('deposit account');
    if (receipt.lineItems.some((li) => !li.externalItemId)) {
      missing.push('giving item');
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `QuickBooks mapping is missing for: ${missing.join(', ')}. ` +
          'Re-open the posting dialog to set it.',
      );
    }

    const payload: Record<string, any> = {
      TxnDate: receipt.transactionDate,
      CustomerRef: { value: receipt.customer.externalCustomerId },
      DepositToAccountRef: { value: receipt.depositAccount.externalAccountId },
      Line: receipt.lineItems.map((li) => ({
        Amount: li.amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: li.externalItemId },
          Qty: li.quantity,
          UnitPrice: li.unitPrice,
          ServiceDate: li.serviceDate,
          ...(li.class
            ? { ClassRef: { value: li.class.externalClassId } }
            : {}),
        },
      })),
      // Global tax — match the church's existing QBO setup (no tax)
      TxnTaxDetail: { TotalTax: 0 },
    };

    if (receipt.referenceNumber) {
      // QBO rejects DocNumber over 21 characters; MoMo references can be longer,
      // so keep the tail, which is the part that actually distinguishes them.
      payload.DocNumber = receipt.referenceNumber.slice(-21);
    }
    if (receipt.location?.externalLocationId) {
      payload.DepartmentRef = { value: receipt.location.externalLocationId };
    }

    return payload;
  }
}
