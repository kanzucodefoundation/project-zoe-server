import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';

export interface AccountingSalesReceiptLineItem {
  category: string;
  externalItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  serviceDate: string;
  class: {
    /** Null when the giver has no FOB and the tenant default was used. */
    groupId: number | null;
    groupName: string;
    externalClassId: string;
    isFallback: boolean;
  } | null;
}

export interface AccountingSalesReceipt {
  transactionId: number;
  transactionDate: string;
  referenceNumber: string | null;
  customer: {
    contactId: number;
    contactName: string;
    externalCustomerId: string;
  };
  depositAccount: {
    financialAccountId: number;
    financialAccountName: string;
    externalAccountId: string;
  };
  location: {
    /** Null when the giver has no Location and the tenant default was used. */
    groupId: number | null;
    groupName: string;
    externalLocationId: string;
    isFallback: boolean;
  } | null;
  lineItems: AccountingSalesReceiptLineItem[];
  totalAmount: number;
  currency: string;
}

export interface IAccountingPostingPlugin {
  buildSalesReceipt(
    transaction: Transaction,
    match: ReconciliationMatch,
  ): Promise<AccountingSalesReceipt>;
}
