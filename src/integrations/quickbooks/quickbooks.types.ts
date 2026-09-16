/**
 * The subset of QuickBooks entity fields Project Zoe actually reads.
 *
 * Intuit's API returns untyped JSON with far more on each entity than we use.
 * Rather than passing `any` around, these describe only the fields the posting
 * flow depends on, so a misspelled property is a compile error instead of a
 * silent `undefined` at run time.
 */

export interface QboRef {
  value: string;
  name?: string;
}

/** Anything with an id and a name: Item, Class, Department. */
export interface QboNamedEntity {
  Id: string;
  Name: string;
}

export interface QboCustomer {
  Id: string;
  SyncToken?: string;
  DisplayName?: string;
  FullyQualifiedName?: string;
  CompanyName?: string;
  PrintOnCheckName?: string;
  GivenName?: string;
  FamilyName?: string;
  /** Mr, Mrs, Ms — the only gender signal QuickBooks carries. */
  Title?: string;
  Notes?: string;
  /** Set when this customer is a sub-customer, e.g. a giver under their campus. */
  ParentRef?: QboRef;
  Job?: boolean;
  PrimaryPhone?: { FreeFormNumber?: string };
  Mobile?: { FreeFormNumber?: string };
  PrimaryEmailAddr?: { Address?: string };
}

export interface QboAccount extends QboNamedEntity {
  AccountType?: string;
  AcctNum?: string;
  CurrencyRef?: QboRef;
}

export interface QboSalesReceipt {
  Id?: string;
  DocNumber?: string;
}

/** One entry from Intuit's `Fault.Error` array. */
export interface QboFault {
  code?: string | number;
  Message?: string;
  Detail?: string;
}

/** The shape of an Axios error body when QuickBooks rejects a request. */
export interface QboErrorBody {
  Fault?: { Error?: QboFault[] };
}
