import { decodeBolt11Amount } from './decodeBolt11';

describe('decodeBolt11Amount', () => {
  it('decodes micro-BTC (u): lnbc2500u → 250000 sats', () => {
    expect(decodeBolt11Amount('lnbc2500u1pabcdef')).toBe(250_000);
  });

  it('decodes milli-BTC (m): lnbc20m → 2 000 000 sats', () => {
    expect(decodeBolt11Amount('lnbc20m1pxyz')).toBe(2_000_000);
  });

  it('decodes nano-BTC (n): lnbc1500n → 150 sats', () => {
    expect(decodeBolt11Amount('lnbc1500n1pqqq')).toBe(150);
  });

  it('rounds pico-BTC (p) to nearest sat', () => {
    expect(decodeBolt11Amount('lnbc10000p1p')).toBe(1); // 10000 * 1e-4 = 1
  });

  it('strips a lightning: prefix and is case-insensitive', () => {
    expect(decodeBolt11Amount('lightning:LNBC10U1PABC')).toBe(1000);
  });

  it('returns null for an any-amount invoice (no amount in HRP)', () => {
    expect(decodeBolt11Amount('lnbc1pabcdef')).toBeNull();
  });

  it('returns null for non-invoices and empty input', () => {
    expect(decodeBolt11Amount('hello world')).toBeNull();
    expect(decodeBolt11Amount('')).toBeNull();
    expect(decodeBolt11Amount(undefined as unknown as string)).toBeNull();
  });
});
