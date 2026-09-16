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
