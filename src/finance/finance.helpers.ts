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

/** Comparable form of a tithe number: "tbg 9088" and "TBG-9088" are one code. */
export function normalizeTitheNumber(
  value: string | null | undefined,
): string | null {
  const normalized = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.length >= 4 ? normalized : null;
}

function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshteinDistance(a, b) / longest;
}

const TOKEN_MATCH_THRESHOLD = 0.8;

/**
 * Similarity between two personal names, 0 to 1.
 *
 * Compared token by token and order-insensitively, because statements name
 * people in whatever order and depth they like: "AYIKORU ELAINE" and "Elaine
 * Keziah Ayikoru" are the same giver, and whole-string distance scores them
 * barely above unrelated. Scoring is against the shorter name, so a missing
 * middle name costs nothing, and every token of the shorter name must be
 * accounted for before the score can be high.
 */
export function calculateNameSimilarity(
  name1: string | null | undefined,
  name2: string | null | undefined,
): number {
  if (!name1 || !name2) {
    return 0;
  }

  const tokens1 = nameTokens(name1);
  const tokens2 = nameTokens(name2);

  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0;
  }

  const [shorter, longer] =
    tokens1.length <= tokens2.length ? [tokens1, tokens2] : [tokens2, tokens1];

  const unmatched = [...longer];
  let total = 0;

  for (const token of shorter) {
    let bestScore = 0;
    let bestIndex = -1;

    unmatched.forEach((candidate, index) => {
      const score = tokenSimilarity(token, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && bestScore >= TOKEN_MATCH_THRESHOLD) {
      unmatched.splice(bestIndex, 1);
      total += bestScore;
    }
  }

  return total / shorter.length;
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
