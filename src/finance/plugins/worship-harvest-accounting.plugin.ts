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
  ) {}

  async buildSalesReceipt(
    transaction: Transaction,
    match: ReconciliationMatch,
  ): Promise<AccountingSalesReceipt> {
    const contactId = match.contact?.id;

    // ── Contact → QBO Customer ───────────────────────────────────────────────
    const contact = await this.contactRepo.findOne({
      where: { id: contactId },
      relations: ['person'],
    });
    const customerMapping = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'CONTACT',
      internalReferenceId: contactId,
      externalReferenceType: 'CUSTOMER',
    });

    // ── FinancialAccount → QBO Account ───────────────────────────────────────
    const account = await this.accountRepo.findOne({
      where: { id: transaction.account?.id ?? (transaction as any).accountId },
    });
    const accountMapping = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'FINANCIAL_ACCOUNT',
      internalReferenceId: account?.id,
      externalReferenceType: 'ACCOUNT',
    });

    // ── Contact → Location → QBO Department ─────────────────────────────────
    const { location, fob } =
      await this.groupPermissionsService.resolveForContact(contactId);

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
    const categoryKey = transaction.category ?? 'TITHE';
    const itemMapping = await this.mappingService.lookupByInternal({
      system: SYSTEM,
      internalReferenceType: 'GIVING_CATEGORY',
      internalReferenceId: categoryKey,
      externalReferenceType: 'ITEM',
    });

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
        contactName: contact
          ? getPersonFullName(contact.person) ?? `Contact ${contactId}`
          : `Contact ${contactId}`,
        externalCustomerId: customerMapping?.externalReferenceId ?? null,
      },
      depositAccount: {
        financialAccountId: account?.id ?? null,
        financialAccountName: account?.name ?? null,
        externalAccountId: accountMapping?.externalReferenceId ?? null,
      },
      location: location
        ? {
            groupId: location.id,
            groupName: location.name,
            externalLocationId: locationMapping?.externalReferenceId ?? null,
          }
        : null,
      lineItems: [
        {
          category: categoryKey,
          externalItemId: itemMapping?.externalReferenceId ?? null,
          description: `${categoryKey} — ${
            contact ? getPersonFullName(contact.person) : ''
          } ${txnDate}`.trim(),
          quantity: 1,
          unitPrice: amount,
          amount,
          serviceDate: txnDate,
          class: fob
            ? {
                groupId: fob.id,
                groupName: fob.name,
                externalClassId: fobMapping?.externalReferenceId ?? null,
              }
            : null,
        },
      ],
      totalAmount: amount,
      currency: account?.currency ?? 'UGX',
    };
  }
}
