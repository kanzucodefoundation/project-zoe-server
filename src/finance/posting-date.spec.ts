import {
  isPostingDateDeferred,
  reportingWeekStart,
  resolvePostingDate,
  toIsoDate,
} from './posting-date';

describe('posting-date', () => {
  describe('reportingWeekStart', () => {
    it.each([
      ['2026-10-12', '2026-10-12'],
      ['2026-10-15', '2026-10-12'],
      ['2026-10-18', '2026-10-12'],
      ['2026-10-19', '2026-10-19'],
    ])('places %s in the week beginning %s', (date, expected) => {
      expect(reportingWeekStart(date)).toBe(expected);
    });

    it('returns null for a value that is not a date', () => {
      expect(reportingWeekStart('last sunday')).toBeNull();
    });

    it('returns null for a day that month does not have', () => {
      // Date.UTC would roll these into the next month and answer with a week
      // the gift never belonged to.
      expect(reportingWeekStart('2026-02-30')).toBeNull();
      expect(reportingWeekStart('2026-13-01')).toBeNull();
      expect(reportingWeekStart('2026-04-31')).toBeNull();
    });
  });

  describe('toIsoDate', () => {
    it('reads a Date in the finance zone, not the host zone', () => {
      expect(toIsoDate(new Date('2026-10-18T22:30:00.000Z'))).toBe(
        '2026-10-19',
      );
    });

    it('keeps a date-only string as it is', () => {
      expect(toIsoDate('2026-10-18')).toBe('2026-10-18');
    });

    it('trims a timestamp string to its date', () => {
      expect(toIsoDate('2026-10-18 09:15:00')).toBe('2026-10-18');
    });

    it('reads a string carrying an offset the same way as the Date', () => {
      // Late UTC on the 18th is already the 19th in Kampala, and a string and
      // a Date for the same instant must not disagree about which week it is.
      expect(toIsoDate('2026-10-18T22:30:00.000Z')).toBe('2026-10-19');
      expect(toIsoDate('2026-10-18T22:30:00.000Z')).toBe(
        toIsoDate(new Date('2026-10-18T22:30:00.000Z')),
      );
      expect(toIsoDate('2026-10-19T01:30:00+03:00')).toBe('2026-10-19');
    });
  });

  describe('resolvePostingDate', () => {
    it('keeps the date when the gift is imported in its own week', () => {
      expect(resolvePostingDate('2026-10-18', '2026-10-18')).toBe('2026-10-18');
    });

    it('keeps the date when the gift is imported before it', () => {
      expect(resolvePostingDate('2026-10-18', '2026-10-14')).toBe('2026-10-18');
    });

    it('moves a Sunday gift found a week later to the following Monday', () => {
      expect(resolvePostingDate('2026-10-18', '2026-10-25')).toBe('2026-10-19');
    });

    it('moves a Sunday gift found the next day, which is a new week', () => {
      expect(resolvePostingDate('2026-10-18', '2026-10-19')).toBe('2026-10-19');
    });

    it('moves a weekday gift to the Monday after its own week', () => {
      expect(resolvePostingDate('2026-10-15', '2026-10-25')).toBe('2026-10-19');
    });

    it('does not keep shifting a gift found much later', () => {
      expect(resolvePostingDate('2026-10-18', '2026-12-01')).toBe('2026-10-19');
    });

    it('uses the finance zone to decide which week an import fell in', () => {
      expect(
        resolvePostingDate('2026-10-18', new Date('2026-10-18T22:30:00.000Z')),
      ).toBe('2026-10-19');
    });

    it('defers a gift whose import timestamp arrives as a string', () => {
      // The instant is 01:30 on Monday the 19th in Kampala, a new reporting
      // week, so the Sunday gift moves even though the text reads "18".
      expect(resolvePostingDate('2026-10-18', '2026-10-18T22:30:00.000Z')).toBe(
        '2026-10-19',
      );
    });

    it('keeps the date when nothing says when it was imported', () => {
      expect(resolvePostingDate('2026-10-18', null)).toBe('2026-10-18');
    });

    it('keeps an unparseable date untouched', () => {
      expect(resolvePostingDate('not-a-date', '2026-10-25')).toBe('not-a-date');
    });
  });

  describe('isPostingDateDeferred', () => {
    it('is true only when the posting date was moved', () => {
      expect(isPostingDateDeferred('2026-10-18', '2026-10-25')).toBe(true);
      expect(isPostingDateDeferred('2026-10-18', '2026-10-18')).toBe(false);
    });
  });
});
