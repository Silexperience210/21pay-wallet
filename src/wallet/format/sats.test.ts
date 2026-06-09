// Req WALLET-07 — display formatting.
import { formatSats, satsToFiat, formatFiat } from './sats';

describe('sats/fiat formatting', () => {
  it('formats sats with grouped thousands and a lowercase suffix', () => {
    expect(formatSats(1234567)).toBe('1,234,567 sats');
    expect(formatSats(0)).toBe('0 sats');
    expect(formatSats(100.7)).toBe('100 sats'); // floors, no fractional sats
  });

  it('converts sats to fiat exactly, degrading to 0 on a missing rate', () => {
    expect(satsToFiat(100000, 0.0004)).toBe(40);
    expect(satsToFiat(100000, undefined)).toBe(0);
    expect(satsToFiat(1, 0.00038)).toBe(0); // rounds to 2dp
  });

  it('formats fiat with the ≈ prefix and currency symbol', () => {
    expect(formatFiat(38.4)).toBe('≈ €38.40');
    expect(formatFiat(12.5, 'USD')).toBe('≈ $12.50');
  });
});
