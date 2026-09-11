import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
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

export interface PreflightBlocker {
  code: string;
  message: string;
}

export interface PreflightResult {
  ready: boolean;
  blockers: PreflightBlocker[];
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
