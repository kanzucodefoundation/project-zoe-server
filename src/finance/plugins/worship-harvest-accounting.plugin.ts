import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Contact from '../../crm/entities/contact.entity';
import FinancialAccount from '../entities/financial-account.entity';
import {
  IAccountingPostingPlugin,
  AccountingSalesReceipt,
} from '../interfaces/accounting-plugin.interface';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';
import { GroupPermissionsService } from '../../groups/services/group-permissions.service';
import { getPersonFullName } from '../../crm/crm.helpers';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { resolveTransactionCategory } from '../enums/transaction-category.enum';
import { CategoryRoutingService } from '../services/category-routing.service';
import { DEFAULT_CURRENCY } from '../constants/accounting-mapping.constants';

const SYSTEM = 'QUICKBOOKS';

@Injectable()
export class WorshipHarvestAccountingPlugin
  implements IAccountingPostingPlugin
{
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(FinancialAccount)
    private readonly accountRepo: Repository<FinancialAccount>,
    private readonly mappingService: ExternalSystemMappingService,
    private readonly groupPermissionsService: GroupPermissionsService,
    private readonly tenantContext: TenantContext,
    private readonly categoryRoutingService: CategoryRoutingService,
  ) {}

  /** Mother-group attribution for a gift with no giver behind it. */
  private async resolveRootAttribution() {
    const root = await this.groupPermissionsService.getRootGroup();
    return {
      location: root,
      fob: root,
      locationIsFallback: !!root,
      fobIsFallback: !!root,
    };
  }

  async buildSalesReceipt(
    transaction: Transaction,
    match: ReconciliationMatch | null,
  ): Promise<AccountingSalesReceipt> {
    // Null for offertory: collected in the room, so there is nobody to match.
    const contactId = match?.contact?.id ?? null;
    // Both repositories below are plain, untenanted repositories, so every
    // lookup has to carry the tenant itself. Without it a crafted id could read
    // another church's contact or account.
    const tenantId = this.tenantContext.requireTenant();

    // ── Contact → QBO Customer ───────────────────────────────────────────────
    const contact = contactId
      ? await this.contactRepo.findOne({
          where: { id: contactId, tenantId },
          relations: ['person'],
        })
      : null;
    const customerMapping = contactId
      ? await this.mappingService.lookupByInternal({
          system: SYSTEM,
          internalReferenceType: 'CONTACT',
          internalReferenceId: contactId,
          externalReferenceType: 'CUSTOMER',
        })
      : null;

    // ── FinancialAccount → QBO Account ───────────────────────────────────────
    const account = await this.accountRepo.findOne({
      where: {
        id: transaction.account?.id ?? (transaction as any).accountId,
        tenant: { id: tenantId },
      },
    });
    const accountMapping = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'FINANCIAL_ACCOUNT',
      internalReferenceId: account?.id,
      externalReferenceType: 'ACCOUNT',
    });

    // ── Contact → Location → QBO Department ─────────────────────────────────
    // Falls back to the mother group when the giver is in no Location or FOB.
    // With no giver the campus cannot be derived from one, so it falls back to
    // the mother group — flagged as a fallback so the preview shows it as such.
    const { location, fob, locationIsFallback, fobIsFallback } = contactId
      ? await this.groupPermissionsService.resolveAttributionForContact(
          contactId,
        )
      : await this.resolveRootAttribution();

    const locationMapping = location
      ? await this.mappingService.lookupByInternal({
          system: SYSTEM,
          internalReferenceType: 'GROUP',
          internalReferenceId: location.id,
          externalReferenceType: 'LOCATION',
        })
      : null;

    // ── FOB → QBO Class ──────────────────────────────────────────────────────
    const fobMapping = fob
      ? await this.mappingService.lookupByInternal({
          system: SYSTEM,
          internalReferenceType: 'GROUP',
          internalReferenceId: fob.id,
          externalReferenceType: 'CLASS',
        })
      : null;

    // ── Transaction category → QBO Item ─────────────────────────────────────
    const categoryKey = resolveTransactionCategory(transaction.category);
    const itemMapping = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'GIVING_CATEGORY',
      internalReferenceId: categoryKey,
      externalReferenceType: 'ITEM',
    });

    // ── Category + currency → standing QBO Customer ─────────────────────────
    const currency = account?.currency ?? DEFAULT_CURRENCY;
    const collected = this.categoryRoutingService.isCurrencyRouted(categoryKey);
    // Offerings book against their own income item, chosen by currency.
    const categoryItem = await this.categoryRoutingService.resolveGivingItem(
      categoryKey,
      currency,
    );
    const categoryDeposit =
      await this.categoryRoutingService.resolveDepositAccount(
        categoryKey,
        currency,
      );

    const amount = Number(transaction.amount);
    const txnDate =
      transaction.transactionDate instanceof Date
        ? transaction.transactionDate.toISOString().slice(0, 10)
        : String(transaction.transactionDate);

    return {
      transactionId: transaction.id,
      transactionDate: txnDate,
      referenceNumber: transaction.externalReference ?? null,
      customer: {
        contactId,
        contactName: collected
          ? 'Collected offering'
          : contact
          ? getPersonFullName(contact.person) ?? `Contact ${contactId}`
          : transaction.senderName ?? `Contact ${contactId}`,
        // Offertory carries no customer at all — it is not anyone's gift.
        externalCustomerId: collected
          ? null
          : customerMapping?.externalReferenceId ?? null,
        postsAs: collected ? 'CATEGORY' : 'GIVER',
        externalCustomerName: null,
      },
      depositAccount: {
        financialAccountId: account?.id ?? null,
        financialAccountName: account?.name ?? null,
        externalAccountId:
          categoryDeposit.externalAccountId ??
          accountMapping?.externalReferenceId ??
          null,
      },
      location:
        location && locationMapping
          ? {
              groupId: location.id,
              groupName: location.name,
              externalLocationId: locationMapping.externalReferenceId,
              isFallback: locationIsFallback,
            }
          : null,
      lineItems: [
        {
          category:
            categoryItem.externalItemName ??
            transaction.externalItemName ??
            categoryKey,
          // A statement that named a specific product/service books against it;
          // the category mapping is only the fallback.
          externalItemId:
            categoryItem.externalItemId ??
            transaction.externalItemId ??
            itemMapping?.externalReferenceId ??
            null,
          description: collected
            ? `${categoryKey} ${txnDate}`
            : `${categoryKey} — ${
                contact
                  ? getPersonFullName(contact.person)
                  : transaction.senderName ?? ''
              } ${txnDate}`.trim(),
          quantity: 1,
          unitPrice: amount,
          amount,
          serviceDate: txnDate,
          class:
            fob && fobMapping
              ? {
                  groupId: fob.id,
                  groupName: fob.name,
                  externalClassId: fobMapping.externalReferenceId,
                  isFallback: fobIsFallback,
                }
              : null,
        },
      ],
      totalAmount: amount,
      currency: account?.currency ?? 'UGX',
    };
  }
}
