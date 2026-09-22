import { TransactionCategory } from '../enums/transaction-category.enum';

/**
 * Shared reference-mapping constants for the QuickBooks posting flow.
 *
 * Kept in their own module so both `AccountingService` and the accounting
 * plugin can use them without importing each other (the service already depends
 * on the plugin, so the reverse import would be circular).
 */

export const ACCOUNTING_SYSTEM = 'QUICKBOOKS';

/**
 * Names of the catch-all records in the church's QuickBooks company, used to
 * pre-select a suggestion when mapping the mother group (the fallback for
 * givers with no Location or FOB). Only a hint for the setup dialog — whatever
 * the operator picks is what gets persisted, so these never have to be right.
 */
export const QBO_DEFAULT_LOCATION_NAME = 'WH Central';
export const QBO_DEFAULT_CLASS_NAME = 'Central';

/** Categories booked to a standing customer per currency, e.g. Offertory UGX. */
export const CATEGORY_CURRENCY_REFERENCE_TYPE = 'CATEGORY_CURRENCY';

/** Collected rather than given, so they carry no giver and route by currency. */
export const CURRENCY_ROUTED_CATEGORIES: readonly string[] = [
  TransactionCategory.OFFERING,
];

/** Currency is upper-cased so 'ugx' and 'UGX' cannot become two mappings. */
export const categoryCurrencyKey = (
  category: string,
  currency: string,
): string => `${category}:${(currency || '').trim().toUpperCase()}`;

/** Assumed when a financial account names no currency. */
export const DEFAULT_CURRENCY = 'UGX';

/** QuickBooks only accepts these account types as a sales-receipt deposit. */
export const QBO_DEPOSITABLE_ACCOUNT_TYPES = ['Bank', 'Other Current Asset'];

/** Sentinel choice: deposit where the statement was imported, no override. */
export const DEPOSIT_ACCOUNT_NONE = '__imported_account__';
