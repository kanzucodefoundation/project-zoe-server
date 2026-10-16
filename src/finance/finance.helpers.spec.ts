import {
  calculateNameSimilarity,
  normalizeTitheNumber,
} from './finance.helpers';

describe('normalizeTitheNumber', () => {
  it('reduces the ways a code can be written to one', () => {
    expect(normalizeTitheNumber('tbg-9088')).toBe('TBG9088');
    expect(normalizeTitheNumber(' TBG 9088 ')).toBe('TBG9088');
    expect(normalizeTitheNumber('TBG9088')).toBe('TBG9088');
  });

  it('rejects anything too short to identify a giver', () => {
    expect(normalizeTitheNumber('--')).toBeNull();
    expect(normalizeTitheNumber('12')).toBeNull();
    expect(normalizeTitheNumber(null)).toBeNull();
    expect(normalizeTitheNumber(undefined)).toBeNull();
  });
});

describe('calculateNameSimilarity', () => {
  it('scores an exact name as a full match', () => {
    expect(calculateNameSimilarity('Elaine Ayikoru', 'elaine ayikoru')).toBe(1);
  });

  it('ignores the order the names were written in', () => {
    expect(
      calculateNameSimilarity('AYIKORU ELAINE', 'Elaine Ayikoru'),
    ).toBeGreaterThan(0.9);
  });

  it('does not penalise a middle name the statement left out', () => {
    expect(
      calculateNameSimilarity('Elaine Ayikoru', 'Elaine Keziah Ayikoru'),
    ).toBeGreaterThan(0.9);
  });

  it('tolerates a misspelt name', () => {
    expect(
      calculateNameSimilarity('Joshua Nabugere', 'Joshua Nabugare'),
    ).toBeGreaterThan(0.8);
  });

  it('scores unrelated people low', () => {
    expect(
      calculateNameSimilarity('Elaine Ayikoru', 'Moses Kigongo'),
    ).toBeLessThan(0.6);
  });

  it('does not match one shared surname as the same person', () => {
    expect(
      calculateNameSimilarity('Peter Mukasa', 'Sarah Mukasa'),
    ).toBeLessThan(0.6);
  });

  it('returns zero when either name is missing', () => {
    expect(calculateNameSimilarity(null, 'Elaine Ayikoru')).toBe(0);
    expect(calculateNameSimilarity('Elaine Ayikoru', '')).toBe(0);
  });
});
