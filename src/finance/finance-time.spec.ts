import {
  FINANCE_TIMEZONE,
  financeDayRange,
  getZonedParts,
  parseStatementDate,
} from './finance-time';

/**
 * These tests are the point of the module: they must hold whatever zone the
 * host runs in, so they assert absolute instants rather than local rendering.
 * Kampala is UTC+3 year-round.
 */
describe('finance-time', () => {
  it('defaults to the Kampala zone', () => {
    expect(FINANCE_TIMEZONE).toBe('Africa/Kampala');
  });

  describe('parseStatementDate', () => {
    it('reads a naive statement timestamp as Kampala wall clock', () => {
      const parsed = parseStatementDate('2026-09-06 09:15');

      // 09:15 EAT is 06:15 UTC
      expect(parsed?.toISOString()).toBe('2026-09-06T06:15:00.000Z');
    });

    it('accepts the ISO T separator', () => {
      expect(parseStatementDate('2026-09-06T09:15')?.toISOString()).toBe(
        '2026-09-06T06:15:00.000Z',
      );
    });

    it('treats a date-only cell as local midnight, not UTC midnight', () => {
      // The bug this prevents: new Date('2026-09-06') is UTC midnight, which
      // is 03:00 in Kampala — still the 6th here, but the previous day for
      // any zone west of UTC.
      expect(parseStatementDate('2026-09-06')?.toISOString()).toBe(
        '2026-09-05T21:00:00.000Z',
      );
    });

    it('respects an explicit offset instead of re-anchoring it', () => {
      expect(parseStatementDate('2026-09-06T09:15:00Z')?.toISOString()).toBe(
        '2026-09-06T09:15:00.000Z',
      );
      expect(
        parseStatementDate('2026-09-06T09:15:00+03:00')?.toISOString(),
      ).toBe('2026-09-06T06:15:00.000Z');
    });

    it('reads day-first slashed dates, as Ugandan exports write them', () => {
      // 06/09/2026 is 6 September, not 9 June
      expect(parseStatementDate('06/09/2026 09:15')?.toISOString()).toBe(
        '2026-09-06T06:15:00.000Z',
      );
    });

    it('reads an Excel serial as a wall clock', () => {
      // 46271.384027… is 2026-09-06 09:13 in Excel's reckoning
      const serial = 46271 + (9 * 60 + 15) / 1440;
      const parsed = parseStatementDate(serial);

      expect(parsed?.toISOString().slice(0, 16)).toBe('2026-09-06T06:15');
    });

    it('passes a Date through untouched', () => {
      const date = new Date('2026-09-06T06:15:00.000Z');
      expect(parseStatementDate(date)).toBe(date);
    });

    it('returns null for unusable cells rather than an Invalid Date', () => {
      expect(parseStatementDate('not-a-date')).toBeNull();
      expect(parseStatementDate('')).toBeNull();
      expect(parseStatementDate(null)).toBeNull();
      expect(parseStatementDate(undefined)).toBeNull();
      expect(parseStatementDate(NaN)).toBeNull();
    });
  });

  describe('financeDayRange', () => {
    it('covers both whole days in the finance zone', () => {
      const { from, to } = financeDayRange('2026-09-06', '2026-09-12');

      // 00:00 Kampala on the 6th is 21:00 UTC on the 5th
      expect(from.toISOString()).toBe('2026-09-05T21:00:00.000Z');
      // …through the last millisecond of the 12th, 20:59:59.999 UTC
      expect(to.toISOString()).toBe('2026-09-12T20:59:59.999Z');
    });

    it('includes a transaction late on the final day', () => {
      const { from, to } = financeDayRange('2026-09-06', '2026-09-12');
      // The bug this fixes: new Date('2026-09-12') is midnight, so anything
      // later that day fell outside the range and vanished from reports.
      const lateOnLastDay = parseStatementDate('2026-09-12 22:30') as Date;

      expect(lateOnLastDay >= from && lateOnLastDay <= to).toBe(true);
    });

    it('includes a transaction just after midnight on the first day', () => {
      const { from, to } = financeDayRange('2026-09-06', '2026-09-12');
      const earlyOnFirstDay = parseStatementDate('2026-09-06 00:30') as Date;

      expect(earlyOnFirstDay >= from && earlyOnFirstDay <= to).toBe(true);
    });

    it('excludes the day either side', () => {
      const { from, to } = financeDayRange('2026-09-06', '2026-09-12');
      const dayBefore = parseStatementDate('2026-09-05 23:30') as Date;
      const dayAfter = parseStatementDate('2026-09-13 00:30') as Date;

      expect(dayBefore < from).toBe(true);
      expect(dayAfter > to).toBe(true);
    });

    it('handles a single-day period', () => {
      const { from, to } = financeDayRange('2026-09-06', '2026-09-06');
      const midday = parseStatementDate('2026-09-06 12:00') as Date;

      expect(midday >= from && midday <= to).toBe(true);
      expect(to.getTime() - from.getTime()).toBe(86400000 - 1);
    });
  });

  describe('getZonedParts', () => {
    it('reads the Kampala wall clock, not the host clock', () => {
      // 06:15 UTC is 09:15 on Sunday 6 September in Kampala
      const parts = getZonedParts(new Date('2026-09-06T06:15:00.000Z'));

      expect(parts).toEqual({
        dayOfWeek: 0,
        minutes: 9 * 60 + 15,
        date: '2026-09-06',
        monthDay: '09-06',
      });
    });

    it('rolls the date forward when UTC is still on the previous day', () => {
      // 22:00 UTC Saturday is 01:00 Sunday in Kampala
      const parts = getZonedParts(new Date('2026-09-05T22:00:00.000Z'));

      expect(parts.date).toBe('2026-09-06');
      expect(parts.dayOfWeek).toBe(0);
      expect(parts.minutes).toBe(60);
    });

    it('round-trips a parsed statement timestamp', () => {
      const parsed = parseStatementDate('2026-09-06 09:15');
      const parts = getZonedParts(parsed as Date);

      // What the statement said is what the rules see
      expect(parts.minutes).toBe(9 * 60 + 15);
      expect(parts.dayOfWeek).toBe(0);
      expect(parts.date).toBe('2026-09-06');
    });
  });
});
