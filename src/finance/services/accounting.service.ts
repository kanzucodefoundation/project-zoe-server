import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Contact from '../../crm/entities/contact.entity';
import FinancialAccount from '../entities/financial-account.entity';
import { MatchStatus } from '../enums/match-status.enum';
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
import { getPersonFullName } from '../../crm/crm.helpers';

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
}

export interface DataIssue {
  code: string;
  message: string;
  contactId?: number;
}

export interface SetupResult {
  ready: boolean;
  contact?: { id: number; name: string };
  missingMappings: MissingMappingItem[];
  dataIssues: DataIssue[];
}

export interface SetupMappingItem {
  internalReferenceType: string;
  internalReferenceId: string | number;
  externalReferenceType: string;
  externalReferenceId: string;
  externalReferenceName?: string;
}

export interface ApplySetupDto {
  mappings: SetupMappingItem[];
}

const SYSTEM = 'QUICKBOOKS';

@Injectable()
export class AccountingService {
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
    const categoryKey = txn.category ?? 'TITHE';
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

    // Location?
    const { location, fob } =
      await this.groupPermissionsService.resolveForContact(contactId);
    if (!location) {
      blockers.push({
        code: 'LOCATION_MISSING',
        message: 'Could not resolve a Location group for this contact',
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

    // FOB?
    if (!fob) {
      blockers.push({
        code: 'FOB_MISSING',
        message: 'Could not resolve a FOB group for this contact',
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
    const categoryKey = txn.category ?? 'TITHE';
    const accountId = txn.account?.id ?? (txn as any).accountId;

    const [
      contact,
      account,
      customerMap,
      itemMap,
      accountMap,
      { location, fob },
    ] = await Promise.all([
      this.contactRepo.findOne({
        where: { id: contactId },
        relations: ['person'],
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
      this.groupPermissionsService.resolveForContact(contactId),
    ]);

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

    const [customers, items, accounts, departments, classes] =
      await Promise.all([
        !customerMap
          ? this.qbService.getQboCustomers(tenantId)
          : Promise.resolve([]),
        !itemMap ? this.qbService.getQboItems(tenantId) : Promise.resolve([]),
        !accountMap
          ? this.qbService.getQboAccounts(tenantId)
          : Promise.resolve([]),
        location && !locationMap
          ? this.qbService.getQboDepartments(tenantId)
          : Promise.resolve([]),
        fob && !fobMap
          ? this.qbService.getQboClasses(tenantId)
          : Promise.resolve([]),
      ]);

    const contactName = contact
      ? getPersonFullName(contact.person) || `Contact ${contactId}`
      : `Contact ${contactId}`;

    if (!customerMap) {
      missingMappings.push({
        code: 'CUSTOMER_MAPPING_MISSING',
        internalReferenceType: 'CONTACT',
        internalReferenceId: contactId,
        internalName: contactName,
        externalReferenceType: 'CUSTOMER',
        qboOptions: customers.map((c: any) => ({
          id: c.Id,
          name: c.DisplayName ?? c.FullyQualifiedName ?? c.CompanyName ?? c.Id,
        })),
      });
    }

    if (!itemMap) {
      missingMappings.push({
        code: 'ITEM_MAPPING_MISSING',
        internalReferenceType: 'GIVING_CATEGORY',
        internalReferenceId: categoryKey,
        internalName: categoryKey,
        externalReferenceType: 'ITEM',
        qboOptions: items.map((i: any) => ({ id: i.Id, name: i.Name })),
      });
    }

    if (!accountMap) {
      missingMappings.push({
        code: 'ACCOUNT_MAPPING_MISSING',
        internalReferenceType: 'FINANCIAL_ACCOUNT',
        internalReferenceId: accountId,
        internalName: account?.name ?? `Account ${accountId}`,
        externalReferenceType: 'ACCOUNT',
        qboOptions: accounts.map((a: any) => ({ id: a.Id, name: a.Name })),
      });
    }

    if (!location) {
      dataIssues.push({
        code: 'LOCATION_MISSING',
        message: 'Contact has no Location group — assign them in CRM',
        contactId,
      });
    } else if (!locationMap) {
      missingMappings.push({
        code: 'LOCATION_MAPPING_MISSING',
        internalReferenceType: 'GROUP',
        internalReferenceId: location.id,
        internalName: location.name,
        externalReferenceType: 'LOCATION',
        qboOptions: departments.map((d: any) => ({ id: d.Id, name: d.Name })),
      });
    }

    if (!fob) {
      dataIssues.push({
        code: 'FOB_MISSING',
        message: 'Contact has no FOB group — assign them in CRM',
        contactId,
      });
    } else if (!fobMap) {
      missingMappings.push({
        code: 'CLASS_MAPPING_MISSING',
        internalReferenceType: 'GROUP',
        internalReferenceId: fob.id,
        internalName: fob.name,
        externalReferenceType: 'CLASS',
        qboOptions: classes.map((c: any) => ({ id: c.Id, name: c.Name })),
      });
    }

    return {
      ready: missingMappings.length === 0 && dataIssues.length === 0,
      contact: { id: contactId, name: contactName },
      missingMappings,
      dataIssues,
    };
  }

  async applySetup(
    transactionId: number,
    dto: ApplySetupDto,
  ): Promise<PreflightResult> {
    for (const m of dto.mappings) {
      await this.mappingService.upsert({
        system: SYSTEM,
        internalReferenceType: m.internalReferenceType,
        internalReferenceId: String(m.internalReferenceId),
        externalReferenceType: m.externalReferenceType,
        externalReferenceId: m.externalReferenceId,
        externalReferenceName: m.externalReferenceName,
      });
    }
    return this.preflight(transactionId);
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
      payload.DocNumber = receipt.referenceNumber;
    }
    if (receipt.location?.externalLocationId) {
      payload.DepartmentRef = { value: receipt.location.externalLocationId };
    }

    return payload;
  }
}
