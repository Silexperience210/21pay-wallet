// Decode the AMOUNT a BOLT11 invoice asks for, straight from its human-readable
// prefix (HRP) — no bech32 decode, no dependency. The HRP is
//   ln <currency> <amount?> <multiplier?>
// e.g. `lnbc2500u1...` → 2500 µBTC = 250 000 sats. A bare `lnbc1...` carries no
// amount (any-amount invoice) → null. This is the security-critical bit so the user
// sees what they pay before confirming (T-03-16); memo/expiry need a full decode.

// Amount sits between the currency prefix and the bech32 '1' separator:
//   ln <currency> <digits> <multiplier?> 1 <data…>
// Anchoring the trailing '1' is essential — otherwise a no-amount `lnbc1…` invoice
// would mis-read its separator '1' as the amount.
const HRP_RE = /^ln(?:bc|tb|bcrt|tbs|sb)(\d+)([munp]?)1/i;

// Multiplier → BTC factor (1 BTC = 1e8 sats).
const MULT_TO_SATS: Record<string, number> = {
  '': 1e8, // whole BTC
  m: 1e5, // milli
  u: 1e2, // micro
  n: 1e-1, // nano
  p: 1e-4, // pico
};

/**
 * Sats requested by a BOLT11 invoice, or null when the invoice carries no amount
 * (any-amount) or can't be parsed. Rounds sub-sat (pico) amounts to the nearest sat.
 */
export function decodeBolt11Amount(invoice: string): number | null {
  if (!invoice || typeof invoice !== 'string') return null;
  const s = invoice.trim().replace(/^lightning:/i, '');
  const m = HRP_RE.exec(s);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (!Number.isFinite(num)) return null;
  const mult = MULT_TO_SATS[(m[2] ?? '').toLowerCase()];
  if (mult == null) return null;
  return Math.round(num * mult);
}
