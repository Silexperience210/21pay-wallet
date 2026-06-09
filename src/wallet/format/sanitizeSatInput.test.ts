import { sanitizeSatInput } from './sats';

describe('sanitizeSatInput', () => {
  it('parses plain digits', () => {
    expect(sanitizeSatInput('1000')).toBe(1000);
  });
  it('returns null for empty / non-digit input', () => {
    expect(sanitizeSatInput('')).toBeNull();
    expect(sanitizeSatInput('abc')).toBeNull();
  });
  it('strips separators and non-digits (never NaN/float)', () => {
    expect(sanitizeSatInput('1,000')).toBe(1000);
    expect(sanitizeSatInput('12ab3')).toBe(123);
    expect(sanitizeSatInput('0.5')).toBe(5); // dot stripped → integer sats only
  });
});
