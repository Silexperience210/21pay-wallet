// WALLET-07: display-only sat→fiat rate. Degrades silently to 0 (never throws) —
// fiat is informational, never an on-ramp, so a bad/hung feed must not crash a screen.
export interface SatFiatRate {
  ratePerSat: number;
  currency: string;
}

type FetchLike = (input: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export async function fetchSatFiatRate(
  currency = 'EUR',
  fetchImpl: FetchLike = (globalThis as unknown as { fetch: FetchLike }).fetch,
): Promise<SatFiatRate> {
  try {
    const res = await fetchImpl('https://mempool.space/api/v1/prices');
    if (!res.ok) return { ratePerSat: 0, currency };
    const data = (await res.json()) as Record<string, unknown> | null;
    const btcFiat = data?.[currency] ?? data?.[currency.toUpperCase()];
    if (typeof btcFiat !== 'number' || !Number.isFinite(btcFiat) || btcFiat <= 0) {
      return { ratePerSat: 0, currency };
    }
    return { ratePerSat: btcFiat / 100_000_000, currency }; // BTC→fiat ÷ 1e8 = per-sat
  } catch {
    return { ratePerSat: 0, currency };
  }
}
