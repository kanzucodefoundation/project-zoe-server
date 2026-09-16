import { csvCell } from './quickbooks.controller';

/**
 * These exports are opened in Excel or Google Sheets by finance staff, and
 * every value in them comes from QuickBooks — which means from whoever can edit
 * the church's QBO company, not from this codebase. A customer named
 * `=cmd|...` is a valid QuickBooks customer and an executable formula in a
 * spreadsheet, so neutralising it is not defensive tidiness; it is the only
 * thing standing between a display name and code running on a finance
 * workstation.
 */
describe('csvCell', () => {
  it('quotes ordinary values without altering them', () => {
    expect(csvCell('Joshua Nabugere')).toBe('"Joshua Nabugere"');
  });

  it('renders null and undefined as an empty field', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('keeps a value containing a comma in one field', () => {
    expect(csvCell('Nabugere, Joshua')).toBe('"Nabugere, Joshua"');
  });

  it('doubles an embedded quote the way CSV requires', () => {
    // JSON.stringify would have backslash-escaped this, which spreadsheet
    // software does not understand.
    expect(csvCell('Joshua "JJ" Nabugere')).toBe('"Joshua ""JJ"" Nabugere"');
  });

  it('leaves a backslash alone rather than escaping it', () => {
    expect(csvCell('WHM\\Kampala')).toBe('"WHM\\Kampala"');
  });

  it.each(['=', '+', '-', '@'])(
    'neutralises a value beginning with %s',
    (lead) => {
      expect(csvCell(`${lead}HYPERLINK("http://evil","click")`)).toBe(
        `"'${lead}HYPERLINK(""http://evil"",""click"")"`,
      );
    },
  );

  it('neutralises a leading tab or carriage return used to hide the trigger', () => {
    expect(csvCell('\t=1+1')).toBe('"\'\t=1+1"');
    expect(csvCell('\r=1+1')).toBe('"\'\r=1+1"');
  });

  it('does not touch a formula character that is not leading', () => {
    expect(csvCell('Kampala - Nakawa')).toBe('"Kampala - Nakawa"');
    expect(csvCell('a=b')).toBe('"a=b"');
  });

  it('neutralises a negative number, accepting the cost of correctness', () => {
    // A leading "-" cannot be distinguished from a formula, so it is prefixed.
    // These columns carry names and identifiers, not amounts, so nothing here
    // is arithmetic that a spreadsheet needs to keep numeric.
    expect(csvCell('-500')).toBe('"\'-500"');
  });
});
