import { BadRequestException } from '@nestjs/common';

/**
 * Timezone handling for finance imports and category rules.
 *
 * Statement exports carry wall-clock readings: a mobile money row saying
 * "2026-09-06 09:15" means quarter past nine *in Kampala*, regardless of where
 * the server runs. Node parses such a string in the server's local zone, so on
 * a UTC production host that 09:15 becomes 12:15 East Africa Time — enough to
 * push a Sunday service outside an 08:00-12:00 category rule, or past midnight
 * onto the wrong day entirely.
 *
 * Everything here therefore converts between wall-clock readings in the finance
 * timezone and absolute instants, rather than relying on the host's zone.
 * Timestamps that already carry an explicit offset (a trailing `Z` or `+03:00`)
 * are absolute and are left alone.
 */

/**
 * The zone church finances are reckoned in. Africa/Kampala is UTC+3 with no
 * daylight saving, but the conversion below is DST-correct anyway so this can
 * be pointed at any IANA zone.
 */
export const FINANCE_TIMEZONE =
  process.env.FINANCE_TIMEZONE || 'Africa/Kampala';

/** Wall-clock parts of an instant, as read in the finance timezone. */
export interface ZonedParts {
  /** 0 = Sunday … 6 = Saturday, matching JavaScript's getDay(). */
  dayOfWeek: number;
  /** Minutes since midnight. */
  minutes: number;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 'MM-DD', for rules that recur every year. */
  monthDay: string;
}

const partsFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Reads the wall clock a timezone shows at a given instant. */
function wallClockAt(instantMs: number, timeZone: string): WallClock {
  const parts = partsFormatter(timeZone).formatToParts(new Date(instantMs));
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/**
 * The instant at which `timeZone` shows the given wall clock.
 *
 * Solved by iteration: guess that the wall clock is UTC, measure how far that
 * guess actually lands from the target in the zone, and correct. Two passes
 * settle the case where the correction itself crosses a DST boundary.
 */
function wallClockToInstant(wall: WallClock, timeZone: string): Date {
  const target = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );

  let instant = target;
  for (let pass = 0; pass < 2; pass++) {
    const shown = wallClockAt(instant, timeZone);
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
    );
    instant -= shownAsUtc - target;
  }

  return new Date(instant);
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Wall-clock parts of `date`, read in the finance timezone. Category rules use
 * these instead of getDay()/getHours(), which would read the server's zone.
 */
export function getZonedParts(
  date: Date,
  timeZone: string = FINANCE_TIMEZONE,
): ZonedParts {
  const wall = wallClockAt(date.getTime(), timeZone);
  const monthDay = `${pad(wall.month)}-${pad(wall.day)}`;

  return {
    // Day-of-week of the *zoned* calendar date, not the host's.
    dayOfWeek: new Date(
      Date.UTC(wall.year, wall.month - 1, wall.day),
    ).getUTCDay(),
    minutes: wall.hour * 60 + wall.minute,
    date: `${wall.year}-${monthDay}`,
    monthDay,
  };
}

/**
 * The inclusive instant range covered by two calendar days in the finance
 * timezone.
 *
 * `new Date('2026-09-12')` is UTC midnight, so using it as the upper bound of a
 * range drops the whole of the 12th and, in Kampala, shifts both ends three
 * hours late. A report for 6-12 September therefore has to run from the very
 * start of the 6th to the last millisecond of the 12th, both read locally.
 */
export function financeDayRange(
  startDate: string,
  endDate: string,
  timeZone: string = FINANCE_TIMEZONE,
): { from: Date; to: Date } {
  const from = parseStatementDate(startDate, timeZone);
  const endOfDay = parseStatementDate(`${endDate} 23:59:59`, timeZone);

  if (!from || !endOfDay) {
    throw new BadRequestException(
      `Invalid period: "${startDate}" to "${endDate}". Dates must be in YYYY-MM-DD format.`,
    );
  }

  // 23:59:59.999 — the last instant before the next day begins.
  return { from, to: new Date(endOfDay.getTime() + 999) };
}

/** Excel serial dates count days from 1899-12-30. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

/** 'YYYY-MM-DD', optionally followed by a time, with no zone designator. */
const NAIVE_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
/** 'DD/MM/YYYY' or 'DD-MM-YYYY', optionally followed by a time. */
const NAIVE_SLASHED =
  /^(\d{2})[/-](\d{2})[/-](\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
/** Anything ending in Z or ±HH:MM is already an absolute instant. */
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parses one statement cell into an absolute instant.
 *
 * Values without a zone are treated as wall-clock readings in the finance
 * timezone. Values that carry an explicit offset are already absolute and are
 * parsed as-is. Returns null when the cell cannot be read as a date, so the
 * caller can report the row rather than importing a silent Invalid Date.
 */
export function parseStatementDate(
  value: unknown,
  timeZone: string = FINANCE_TIMEZONE,
): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // ExcelJS hands back a serial number for date-formatted xlsx cells. The
  // serial encodes a wall clock, so it needs the same treatment as a string.
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    const asUtc = new Date(EXCEL_EPOCH_UTC + value * MS_PER_DAY);
    return wallClockToInstant(
      {
        year: asUtc.getUTCFullYear(),
        month: asUtc.getUTCMonth() + 1,
        day: asUtc.getUTCDate(),
        hour: asUtc.getUTCHours(),
        minute: asUtc.getUTCMinutes(),
        second: asUtc.getUTCSeconds(),
      },
      timeZone,
    );
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const naive = NAIVE_DATETIME.exec(text);
  if (naive) {
    const [, year, month, day, hour, minute, second] = naive;
    return wallClockToInstant(
      {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour ?? 0),
        minute: Number(minute ?? 0),
        second: Number(second ?? 0),
      },
      timeZone,
    );
  }

  const slashed = NAIVE_SLASHED.exec(text);
  if (slashed) {
    // Day-first: the documented statement formats are Ugandan exports.
    const [, day, month, year, hour, minute, second] = slashed;
    return wallClockToInstant(
      {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour ?? 0),
        minute: Number(minute ?? 0),
        second: Number(second ?? 0),
      },
      timeZone,
    );
  }

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  // A string with no offset that only Date could parse (e.g. "Sep 6 2026") was
  // read in the server's zone; re-anchor its wall clock to the finance zone.
  if (HAS_OFFSET.test(text)) {
    return parsed;
  }

  return wallClockToInstant(
    {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      hour: parsed.getHours(),
      minute: parsed.getMinutes(),
      second: parsed.getSeconds(),
    },
    timeZone,
  );
}
