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
    groupId: number;
    groupName: string;
    externalClassId: string;
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
    groupId: number;
    groupName: string;
    externalLocationId: string;
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
