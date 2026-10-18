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

  it('charges a middle name the statement left out only lightly', () => {
    // Deliberately short of a perfect score: a name contained in a longer one
    // used to score 1.0, which attributed gifts to the wrong person.
    const score = calculateNameSimilarity(
      'Elaine Ayikoru',
      'Elaine Keziah Ayikoru',
    );
    expect(score).toBeGreaterThan(0.75);
    expect(score).toBeLessThan(1);
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

describe('calculateNameSimilarity — wrong-giver guards', () => {
  it('does not match a name contained in a longer one', () => {
    // One shared token is a hint, not an identification: these are two people.
    expect(calculateNameSimilarity('JOHN', 'John Okello')).toBeLessThan(0.6);
    expect(calculateNameSimilarity('Grace', 'Grace Nakato')).toBeLessThan(0.6);
  });

  it('still treats a reordered full name as the same giver', () => {
    expect(calculateNameSimilarity('Okello John', 'John Okello')).toBe(1);
    expect(
      calculateNameSimilarity('AYIKORU ELAINE', 'Elaine Keziah Ayikoru'),
    ).toBeGreaterThan(0.6);
  });

  it('charges a missing surname more than a missing middle name', () => {
    const middleMissing = calculateNameSimilarity(
      'Elaine Ayikoru',
      'Elaine Keziah Ayikoru',
    );
    const surnameOnly = calculateNameSimilarity('Elaine', 'Elaine Ayikoru');
    expect(middleMissing).toBeGreaterThan(surnameOnly);
  });

  it('keeps an extra surname below auto-approve confidence', () => {
    // 0.8 scores 80 on the 60 + similarity * 25 scale, under an 85 threshold.
    expect(
      calculateNameSimilarity('Okello John', 'John Okello Peter'),
    ).toBeLessThan(1);
  });
});
