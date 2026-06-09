// WALLET-07: sats + fiat display formatting. Fiat is display-only (no on-ramp).
export const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

export function formatSats(n: number): string {
  const v = Math.floor(Number.isFinite(n) ? n : 0); // no fractional sats
  return `${v.toLocaleString('en-US')} sats`;
}

export function satsToFiat(sats: number, ratePerSat?: number): number {
  if (!ratePerSat || !Number.isFinite(ratePerSat) || !Number.isFinite(sats)) return 0;
  return Math.round(sats * ratePerSat * 100) / 100;
}

export function formatFiat(amount: number, currency = 'EUR'): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? '';
  const v = Number.isFinite(amount) ? amount : 0;
  return `≈ ${sym}${v.toFixed(2)}`;
}
