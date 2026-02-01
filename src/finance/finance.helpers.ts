import FinancialAccount from './entities/financial-account.entity';
import Transaction from './entities/transaction.entity';
import ContactPaymentMethod from './entities/contact-payment-method.entity';
import ReconciliationMatch from './entities/reconciliation-match.entity';
import DistributionBatch from './entities/distribution-batch.entity';
import Distribution from './entities/distribution.entity';
import CategoryRule from './entities/category-rule.entity';

export const financeEntities = [
  FinancialAccount,
  Transaction,
  ContactPaymentMethod,
  ReconciliationMatch,
  DistributionBatch,
  Distribution,
  CategoryRule,
];

/**
 * Normalizes a phone number to country code format (e.g., 256772123456)
 * Supports various input formats and international numbers
 *
 * @param phone - The phone number to normalize
 * @param defaultCountryCode - The default country code to use (default: '256' for Uganda)
 * @returns The normalized phone number or null if invalid
 */
export function normalizePhone(
  phone: string | null | undefined,
  defaultCountryCode: string = '256',
): string | null {
  if (!phone) {
    return null;
  }

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Handle empty result
  if (!cleaned || cleaned === '+') {
    return null;
  }

  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If it starts with the country code, return as is
  if (cleaned.startsWith(defaultCountryCode)) {
    return cleaned;
  }

  // If it starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    return defaultCountryCode + cleaned.substring(1);
  }

  // If it's a short number (likely without country code), prepend country code
  // Uganda numbers after country code are typically 9 digits (e.g., 772123456)
  if (cleaned.length <= 9) {
    return defaultCountryCode + cleaned;
  }

  // Return as is if it seems to already have a different country code
  return cleaned;
}

/**
 * Calculates the similarity between two names using Levenshtein distance
 * Returns a value between 0 and 1, where 1 is an exact match
 *
 * @param name1 - First name to compare
 * @param name2 - Second name to compare
 * @returns Similarity score between 0 and 1
 */
export function calculateNameSimilarity(
  name1: string | null | undefined,
  name2: string | null | undefined,
): number {
  if (!name1 || !name2) {
    return 0;
  }

  // Normalize names: lowercase and remove extra whitespace
  const normalized1 = name1.toLowerCase().trim().replace(/\s+/g, ' ');
  const normalized2 = name2.toLowerCase().trim().replace(/\s+/g, ' ');

  if (normalized1 === normalized2) {
    return 1;
  }

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) {
    return 1;
  }

  return 1 - distance / maxLength;
}

/**
 * Computes the Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix to store distances
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1, // substitution
        );
      }
    }
  }

  return dp[m][n];
}
