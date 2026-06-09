// Req WALLET-07 — price feed degrades silently (mocked fetch).
import { fetchSatFiatRate } from './priceFeed';

function fetchReturning(body: unknown, ok = true, status = 200) {
  return (async () => ({ ok, status, json: async () => body })) as never;
}

describe('fetchSatFiatRate', () => {
  it('parses a BTC→fiat price into a per-sat rate', async () => {
    const r = await fetchSatFiatRate('EUR', fetchReturning({ EUR: 40000, USD: 42000 }));
    expect(r.ratePerSat).toBeCloseTo(0.0004, 8);
    expect(r.currency).toBe('EUR');
  });

  it('returns rate 0 on a non-200 without throwing', async () => {
    const r = await fetchSatFiatRate('EUR', fetchReturning({}, false, 500));
    expect(r.ratePerSat).toBe(0);
  });

  it('returns rate 0 on a malformed body', async () => {
    const r = await fetchSatFiatRate('EUR', fetchReturning({ nope: 'x' }));
    expect(r.ratePerSat).toBe(0);
  });

  it('returns rate 0 when fetch throws', async () => {
    const throwing = (async () => {
      throw new Error('network down');
    }) as never;
    const r = await fetchSatFiatRate('EUR', throwing);
    expect(r.ratePerSat).toBe(0);
  });
});
