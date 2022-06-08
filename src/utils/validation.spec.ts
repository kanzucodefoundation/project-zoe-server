import { hasValue } from './validation';

describe('hasValue', () => {
  it('can detect string', () => {
    expect(hasValue('test')).toEqual(true);
    expect(hasValue('')).toEqual(false);
  });

  it('can detect number', () => {
    expect(hasValue(4)).toEqual(true);
    expect(hasValue(0)).toEqual(true);
    expect(hasValue(undefined)).toEqual(false);
  });

  it('can detect date', () => {
    expect(hasValue(new Date())).toEqual(true);
  });
});
