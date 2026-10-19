import {
  FINANCE_TIMEZONE,
  getZonedParts,
  parseStatementDate,
} from './finance-time';

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The calendar date a value falls on in the finance timezone.
 *
 * Strings arrive in both shapes. A statement cell carries a wall-clock reading
 * ("2026-10-18 09:15"), while an import timestamp serialised out of the
 * database carries an explicit offset ("2026-10-18T22:30:00.000Z") and is an
 * absolute instant. Reading the leading characters of both would put that
 * instant on the 18th, when Kampala is already three hours into the 19th, and
 * a gift would then look as though it had been imported inside its own week.
 */
export const toIsoDate = (
  value: Date | string,
  timeZone: string = FINANCE_TIMEZONE,
): string => {
  if (value instanceof Date) {
    return getZonedParts(value, timeZone).date;
  }

  const instant = parseStatementDate(value, timeZone);
  if (instant) {
    return getZonedParts(instant, timeZone).date;
  }

  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : String(value);
};

/**
 * A calendar date as an instant, or null when the value is not one.
 *
 * `Date.UTC` rolls an out-of-range day into the next month, so February 30th
 * would otherwise be read as March 2nd and a late import could be answered
 * with a posting date from the wrong reporting week.
 */
const parseIsoDate = (value: string): Date | null => {
  const match = value.match(ISO_DATE);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  const rolled =
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day;

  return rolled || Number.isNaN(parsed.getTime()) ? null : parsed;
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
 * booked on the Monday of the week it was found in instead of its own date.
 *
 * The week it was found in, rather than the one after its own: a gift
 * surfacing six weeks late would otherwise be booked into a week that has
 * itself long since been disbursed, which is the problem this avoids.
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

  return importWeek;
};

export const isPostingDateDeferred = (
  transactionDate: Date | string,
  importedAt?: Date | string | null,
  timeZone: string = FINANCE_TIMEZONE,
): boolean =>
  resolvePostingDate(transactionDate, importedAt, timeZone) !==
  toIsoDate(transactionDate, timeZone);
