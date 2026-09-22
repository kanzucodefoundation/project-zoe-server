import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';

export interface AccountingSalesReceiptLineItem {
  category: string;
  /** Null when the category has no QuickBooks item mapped; posting must refuse. */
  externalItemId: string | null;
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
    /** The giver's name, kept on the receipt whichever customer it posts to. */
    contactName: string;
    /** The giver's customer, or the standing one for the category + currency. */
    externalCustomerId: string | null;
    /** `CATEGORY` means it books to a standing customer, not the person. */
    postsAs: 'GIVER' | 'CATEGORY';
    externalCustomerName: string | null;
  };
  depositAccount: {
    financialAccountId: number;
    financialAccountName: string;
    /** Null when the financial account has no QuickBooks account mapped. */
    externalAccountId: string | null;
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
