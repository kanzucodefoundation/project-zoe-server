import {
  cleanSenderName,
  detectCategory,
  detectGivingItem,
  extractLocationCode,
  extractPersonName,
  extractPhone,
  extractTitheNumber,
  parseStatementMessage,
} from './statement-parsing';
import { TransactionCategory } from './enums/transaction-category.enum';

describe('statement message parsing', () => {
  /**
   * The "To message" values below are taken verbatim from a Worship Harvest
   * mobile-money export, so these cases pin the parser to real sender habits
   * rather than to a tidy invented format.
   */
  describe('real statement rows', () => {
    it('reads a run-together campus code and category', () => {
      const result = parseStatementMessage('WHARUAYXPOFFERTORY', [
        'WHARUA',
        'WHEBCT',
      ]);
      expect(result.category).toBe(TransactionCategory.OFFERING);
      expect(result.categoryDetected).toBe(true);
      expect(result.locationCode).toBe('WHARUA');
    });

    it('declines to guess a campus code it has not been given', () => {
      const result = parseStatementMessage('WHARUAYXPOFFERTORY');
      expect(result.locationCode).toBeNull();
      // The category is still readable without the code.
      expect(result.category).toBe(TransactionCategory.OFFERING);
    });

    it('reads a lower-case tithe number beside its category', () => {
      const result = parseStatementMessage('tbgb0095 tithe');
      expect(result.titheNumber).toBe('TBGB0095');
      expect(result.category).toBe(TransactionCategory.TITHE);
      expect(result.categoryDetected).toBe(true);
    });

    it('reads a tithe number with a group in brackets', () => {
      const result = parseStatementMessage('TBGB0416(Imbazo)');
      expect(result.titheNumber).toBe('TBGB0416');
      expect(result.category).toBe(TransactionCategory.TITHE);
      expect(result.categoryDetected).toBe(false);
    });

    it('reads a bare tithe number and defaults the category', () => {
      const result = parseStatementMessage('TBGB0148');
      expect(result.titheNumber).toBe('TBGB0148');
      expect(result.category).toBe(TransactionCategory.TITHE);
      expect(result.categoryDetected).toBe(false);
    });

    it('defaults a campus-only message to tithe', () => {
      const result = parseStatementMessage('Arua WH');
      expect(result.category).toBe(TransactionCategory.TITHE);
      expect(result.categoryDetected).toBe(false);
      expect(result.titheNumber).toBeNull();
    });

    it('defaults to tithe when the export has no message column', () => {
      const result = parseStatementMessage(null);
      expect(result.category).toBe(TransactionCategory.TITHE);
      expect(result.categoryDetected).toBe(false);
      expect(result.titheNumber).toBeNull();
      expect(result.name).toBeNull();
    });
  });

  describe('extractPhone', () => {
    it('pulls the MSISDN out of a FRI value', () => {
      expect(extractPhone('FRI:256763676927/MSISDN')).toBe('256763676927');
      expect(extractPhone('FRI:256778618418/MSISDN')).toBe('256778618418');
    });

    it('falls back to a bare number', () => {
      expect(extractPhone('0772123456')).toBe('0772123456');
      expect(extractPhone('+256 772 123 456')).toBe('256772123456');
    });

    it('ignores a wallet identifier that is not an MSISDN', () => {
      // FRI:.../MM is an account id, not a phone number.
      expect(extractPhone('FRI:204945451/MM')).toBeNull();
      expect(extractPhone('FRI:66209845/MM')).toBeNull();
    });

    it('returns null for a short or empty value', () => {
      expect(extractPhone('12345')).toBeNull();
      expect(extractPhone(null)).toBeNull();
    });
  });

  describe('cleanSenderName', () => {
    it('collapses the double spacing these exports contain', () => {
      expect(cleanSenderName('ELAINE   KEZIAH AYIKORU')).toBe(
        'Elaine Keziah Ayikoru',
      );
      expect(cleanSenderName('JOSHUA NABUGERE')).toBe('Joshua Nabugere');
      expect(cleanSenderName('PATRICIA NANDERA')).toBe('Patricia Nandera');
    });

    it('leaves already mixed-case names alone', () => {
      expect(cleanSenderName('Shammah Arinaitwe')).toBe('Shammah Arinaitwe');
      expect(cleanSenderName('John McDonald')).toBe('John McDonald');
    });

    it('drops a FRI identifier or phone glued to the name', () => {
      expect(cleanSenderName('JOSHUA NABUGERE FRI:256763676927/MSISDN')).toBe(
        'Joshua Nabugere',
      );
      expect(cleanSenderName('JOHN OKELLO - 256772123456')).toBe('John Okello');
    });

    it('returns null for empty input', () => {
      expect(cleanSenderName('')).toBeNull();
      expect(cleanSenderName('   ')).toBeNull();
      expect(cleanSenderName(null)).toBeNull();
    });
  });

  describe('extractTitheNumber', () => {
    it('reads the letters-then-digits format', () => {
      expect(extractTitheNumber('TBGB0095')).toBe('TBGB0095');
      expect(extractTitheNumber('tbgb0095 tithe')).toBe('TBGB0095');
      expect(extractTitheNumber('TBGB0416(Imbazo)')).toBe('TBGB0416');
    });

    it('reads a labelled digit-only number', () => {
      expect(extractTitheNumber('tithe no 4471 john')).toBe('4471');
      expect(extractTitheNumber('#307 offering')).toBe('307');
    });

    it('returns null when there is no identifier', () => {
      expect(extractTitheNumber('tithe')).toBeNull();
      expect(extractTitheNumber('Arua WH')).toBeNull();
      expect(extractTitheNumber(null)).toBeNull();
    });
  });

  describe('detectCategory', () => {
    it.each([
      ['TITHE', TransactionCategory.TITHE],
      ['tithes for january', TransactionCategory.TITHE],
      ['OFFERTORY', TransactionCategory.OFFERING],
      ['sunday offering', TransactionCategory.OFFERING],
      ['arise and build', TransactionCategory.ARISE_BUILD],
      ['A&B contribution', TransactionCategory.ARISE_BUILD],
      ['building fund', TransactionCategory.ARISE_BUILD],
      ['thanksgiving', TransactionCategory.DONATION],
    ])('reads %j as %s', (message, expected) => {
      expect(detectCategory(message)).toBe(expected);
    });

    it('matches a long keyword inside a run-together token', () => {
      expect(detectCategory('WHARUAYXPOFFERTORY')).toBe(
        TransactionCategory.OFFERING,
      );
      expect(detectCategory('sundayoffering')).toBe(
        TransactionCategory.OFFERING,
      );
    });

    it('does not match a short keyword inside an unrelated word', () => {
      expect(detectCategory('Nseeda')).toBeNull();
      expect(detectCategory('Arua WH')).toBeNull();
    });

    it('returns null when nothing is recognised', () => {
      expect(detectCategory('')).toBeNull();
      expect(detectCategory(null)).toBeNull();
    });
  });

  describe('extractLocationCode', () => {
    it('reads a delimited campus code without help', () => {
      expect(extractLocationCode('WHEBCT tithe')).toBe('WHEBCT');
    });

    it('resolves a run-together code against the known list', () => {
      expect(
        extractLocationCode('WHARUAYXPOFFERTORY', ['WHARUA', 'WHMKNC']),
      ).toBe('WHARUA');
    });

    it('prefers the longest matching code', () => {
      expect(extractLocationCode('WHMKNCTITHE', ['WHMK', 'WHMKNC'])).toBe(
        'WHMKNC',
      );
    });

    it('returns null rather than guessing where a code ends', () => {
      expect(extractLocationCode('WHARUAYXPOFFERTORY')).toBeNull();
    });

    it('returns null when there is no code', () => {
      expect(extractLocationCode('TBGB0148')).toBeNull();
      expect(extractLocationCode(null)).toBeNull();
    });
  });

  describe('extractPersonName', () => {
    it('returns the words left after category words and digits', () => {
      expect(extractPersonName('TITHE JOHN OKELLO')).toBe('John Okello');
      expect(extractPersonName('offering from mary namu')).toBe('Mary Namu');
    });

    it('strips titles and filler', () => {
      expect(extractPersonName('tithe for Mr John Okello')).toBe('John Okello');
    });

    it('returns null when too little survives to be a name', () => {
      expect(extractPersonName('tithe')).toBeNull();
      expect(extractPersonName('Arua WH')).toBeNull();
      expect(extractPersonName(null)).toBeNull();
    });
  });

  describe('detectGivingItem', () => {
    // The twelve giving items from the church's production QuickBooks.
    const ITEMS = [
      { id: '1', name: 'Tithes' },
      { id: '2', name: "Offertory - Children's Church" },
      { id: '3', name: 'Offertory - Main Garage' },
      { id: '4', name: 'Offertory - Thanksgiving' },
      { id: '5', name: 'Offertory - YXP' },
      { id: '6', name: 'Firstfruits' },
      { id: '7', name: 'Arise and Build' },
      { id: '8', name: 'Products & Services' },
      { id: '9', name: 'Donations' },
      { id: '10', name: 'Other Income' },
      { id: '11', name: 'Buy The Land' },
      { id: '12', name: 'Investment Income' },
    ];

    it('resolves a run-together message to the specific item', () => {
      expect(detectGivingItem('WHARUAYXPOFFERTORY', ITEMS)?.name).toBe(
        'Offertory - YXP',
      );
    });

    it('tolerates the singular the sender actually types', () => {
      expect(detectGivingItem('tbgb0095 tithe', ITEMS)?.name).toBe('Tithes');
      expect(detectGivingItem('my donation', ITEMS)?.name).toBe('Donations');
    });

    it('reaches items the four-value category could never express', () => {
      expect(detectGivingItem('firstfruits january', ITEMS)?.name).toBe(
        'Firstfruits',
      );
      expect(detectGivingItem('BUY THE LAND', ITEMS)?.name).toBe('Buy The Land');
      expect(detectGivingItem('offertory thanksgiving', ITEMS)?.name).toBe(
        'Offertory - Thanksgiving',
      );
    });

    it('prefers the most specific match', () => {
      // "Offertory - Main Garage" needs all three words; a bare offertory
      // message must not be forced onto it.
      expect(detectGivingItem('offertory main garage', ITEMS)?.name).toBe(
        'Offertory - Main Garage',
      );
    });

    it('returns null when the message names no item', () => {
      expect(detectGivingItem('TBGB0148', ITEMS)).toBeNull();
      expect(detectGivingItem('Arua WH', ITEMS)).toBeNull();
      expect(detectGivingItem(null, ITEMS)).toBeNull();
      expect(detectGivingItem('tithe', [])).toBeNull();
    });
  });
});
