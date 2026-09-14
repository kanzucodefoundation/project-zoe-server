export enum TransactionCategory {
  TITHE = 'TITHE',
  OFFERING = 'OFFERING',
  DONATION = 'DONATION',
  ARISE_BUILD = 'ARISE_BUILD',
}

/**
 * Imported mobile-money statement lines often carry no category — the sender
 * just moves money without a reference. Unspecified giving is treated as tithe,
 * so posting is never blocked on a missing category.
 */
export const DEFAULT_TRANSACTION_CATEGORY = TransactionCategory.TITHE;

export const resolveTransactionCategory = (
  category?: TransactionCategory | null,
): TransactionCategory => category ?? DEFAULT_TRANSACTION_CATEGORY;
