import { FINANCE_TIMEZONE, getZonedParts } from './finance-time';

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const toIsoDate = (
  value: Date | string,
  timeZone: string = FINANCE_TIMEZONE,
): string => {
  if (value instanceof Date) {
    return getZonedParts(value, timeZone).date;
  }
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : String(value);
};

const parseIsoDate = (value: string): Date | null => {
  const match = value.match(ISO_DATE);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const parsed = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY);

const formatUtcDate = (date: Date): string => date.toISOString().slice(0, 10);

/** Monday of the Monday-to-Sunday reporting week containing `isoDate`. */
export const reportingWeekStart = (isoDate: string): string | null => {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return null;
  }
  const daysSinceMonday = (parsed.getUTCDay() + 6) % 7;
  return formatUtcDate(addDays(parsed, -daysSinceMonday));
};

/**
 * The date a gift should carry in QuickBooks.
 *
 * Statements are extracted weekly, and the week's funds are disbursed to
 * locations once that week closes. A gift imported in a later reporting week
 * than its own would land in a week that has already been paid out, so it is
 * booked on the Monday that opens the following week instead of its own date.
 */
export const resolvePostingDate = (
  transactionDate: Date | string,
  importedAt?: Date | string | null,
  timeZone: string = FINANCE_TIMEZONE,
): string => {
  const transactionIso = toIsoDate(transactionDate, timeZone);
  if (!importedAt) {
    return transactionIso;
  }

  const transactionWeek = reportingWeekStart(transactionIso);
  const importWeek = reportingWeekStart(toIsoDate(importedAt, timeZone));
  if (!transactionWeek || !importWeek || importWeek <= transactionWeek) {
    return transactionIso;
  }

  const nextWeek = parseIsoDate(transactionWeek);
  return nextWeek ? formatUtcDate(addDays(nextWeek, 7)) : transactionIso;
};

export const isPostingDateDeferred = (
  transactionDate: Date | string,
  importedAt?: Date | string | null,
  timeZone: string = FINANCE_TIMEZONE,
): boolean =>
  resolvePostingDate(transactionDate, importedAt, timeZone) !==
  toIsoDate(transactionDate, timeZone);
