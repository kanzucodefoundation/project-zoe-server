import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Conditions on a category rule, as the rule builder writes them.
 *
 * Everything present must hold (AND), so a rule can express the documented
 * "Sundays between 09:00 and 12:00 on the Central Mobile Money account" as
 * `{ accounts: [1], daysOfWeek: [0], timeRange: { start: '08:00', end: '12:00' } }`.
 */
export interface CategoryRuleConditions {
  /** Financial account ids the rule applies to. */
  accounts?: number[];
  /** Any one of these appearing in narration, sender name or reference. */
  keywords?: string[];
  /** Calendar window, 'YYYY-MM-DD' inclusive. */
  dateRange?: { start: string; end: string };
  /** Time of day, 'HH:mm' inclusive. */
  timeRange?: { start: string; end: string };
  /** 0 = Sunday … 6 = Saturday, matching JavaScript's getDay(). */
  daysOfWeek?: number[];
  /** Treat dateRange as recurring — compare month and day, ignore the year. */
  applyEveryYear?: boolean;
}

/**
 * The original condition shape. Kept because rules created before the rule
 * builder existed are still sitting in the jsonb column in this form.
 */
export interface LegacyRuleCondition {
  field: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex';
  value: string;
}

export type RuleConditions = CategoryRuleConditions | LegacyRuleCondition[];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const LEGACY_OPERATORS = [
  'contains',
  'equals',
  'startsWith',
  'endsWith',
  'regex',
];

const isRange = (value: any, pattern: RegExp): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  typeof value.start === 'string' &&
  typeof value.end === 'string' &&
  pattern.test(value.start) &&
  pattern.test(value.end);

const validateLegacy = (conditions: any[]): string | null => {
  if (conditions.length === 0) {
    return 'conditions must contain at least one condition';
  }

  for (const condition of conditions) {
    if (!condition || typeof condition !== 'object') {
      return 'each legacy condition must be an object';
    }
    if (typeof condition.field !== 'string' || !condition.field) {
      return 'each legacy condition needs a non-empty field';
    }
    if (!LEGACY_OPERATORS.includes(condition.operator)) {
      return `each legacy condition needs one of these operators: ${LEGACY_OPERATORS.join(
        ', ',
      )}`;
    }
    if (typeof condition.value !== 'string' || !condition.value) {
      return 'each legacy condition needs a non-empty value';
    }
  }

  return null;
};

const validateBuilder = (conditions: Record<string, any>): string | null => {
  const {
    accounts,
    keywords,
    dateRange,
    timeRange,
    daysOfWeek,
    applyEveryYear,
    ...unknown
  } = conditions;

  const unknownKeys = Object.keys(unknown);
  if (unknownKeys.length > 0) {
    return `conditions has unsupported keys: ${unknownKeys.join(', ')}`;
  }

  if (
    accounts !== undefined &&
    (!Array.isArray(accounts) ||
      accounts.some((id) => typeof id !== 'number' || !Number.isFinite(id)))
  ) {
    return 'conditions.accounts must be an array of account ids';
  }

  if (
    keywords !== undefined &&
    (!Array.isArray(keywords) ||
      keywords.some((word) => typeof word !== 'string' || !word.trim()))
  ) {
    return 'conditions.keywords must be an array of non-empty strings';
  }

  if (
    daysOfWeek !== undefined &&
    (!Array.isArray(daysOfWeek) ||
      daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
  ) {
    return 'conditions.daysOfWeek must be an array of integers 0 (Sunday) to 6 (Saturday)';
  }

  if (timeRange !== undefined && !isRange(timeRange, TIME_PATTERN)) {
    return 'conditions.timeRange must be { start, end } in HH:mm';
  }

  if (dateRange !== undefined && !isRange(dateRange, DATE_PATTERN)) {
    return 'conditions.dateRange must be { start, end } in YYYY-MM-DD';
  }

  if (applyEveryYear !== undefined && typeof applyEveryYear !== 'boolean') {
    return 'conditions.applyEveryYear must be a boolean';
  }

  const hasAny =
    accounts?.length ||
    keywords?.length ||
    daysOfWeek?.length ||
    timeRange ||
    dateRange;

  if (!hasAny) {
    // A rule with nothing to match on would either catch every transaction or
    // none; both are surprising. Make the author say what they meant.
    return 'conditions must contain at least one of accounts, keywords, daysOfWeek, timeRange or dateRange';
  }

  return null;
};

/**
 * Accepts either conditions shape and explains precisely what is wrong,
 * rather than reporting the builder's object as a malformed legacy array
 * ("conditions.field must be a string").
 */
@ValidatorConstraint({ name: 'isRuleConditions', async: false })
export class IsRuleConditions implements ValidatorConstraintInterface {
  private message = 'conditions is invalid';

  validate(value: any): boolean {
    if (!value || typeof value !== 'object') {
      this.message =
        'conditions must be an object of rule conditions, or an array of legacy conditions';
      return false;
    }

    const error = Array.isArray(value)
      ? validateLegacy(value)
      : validateBuilder(value);

    if (error) {
      this.message = error;
      return false;
    }

    return true;
  }

  defaultMessage(_args: ValidationArguments): string {
    return this.message;
  }
}
