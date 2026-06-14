// LMSR (Logarithmic Market Scoring Rule) — ported verbatim from hunch-web/lib/lmsr.ts.
// The math for a mint-as-market-maker so every market is instantly bettable (no
// order-book cold start). The market maker is always willing to sell YES/NO shares
// at a price that moves with demand; its worst-case subsidy is bounded by b·ln(2).
//
// b        = liquidity depth (bigger = deeper book, more capital at risk).
// qYes/qNo = shares (sats of payout) already sold of each side.
// A winning share pays 1 unit (we price in the same unit, e.g. sat-of-payout). Pure + tested.

/** Numerically-stable log-sum-exp. */
function lse(a: number, b: number): number {
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

/** LMSR cost function C(q) = b · ln(e^(qYes/b) + e^(qNo/b)). */
export function cost(qYes: number, qNo: number, b: number): number {
  return b * lse(qYes / b, qNo / b);
}

/** Instantaneous price of a YES share, in [0,1] (the implied probability). */
export function priceYes(qYes: number, qNo: number, b: number): number {
  const m = Math.max(qYes / b, qNo / b);
  const ey = Math.exp(qYes / b - m);
  const en = Math.exp(qNo / b - m);
  return ey / (ey + en);
}

export function priceNo(qYes: number, qNo: number, b: number): number {
  return 1 - priceYes(qYes, qNo, b);
}

/** Cost (sats) to buy `shares` of `side` now — the integral of price as the book moves against you. */
export function costToBuy(side: 'YES' | 'NO', shares: number, qYes: number, qNo: number, b: number): number {
  const after = side === 'YES' ? cost(qYes + shares, qNo, b) : cost(qYes, qNo + shares, b);
  return after - cost(qYes, qNo, b);
}

/** The market maker's worst-case subsidy (max loss) for liquidity depth `b`. */
export function maxSubsidy(b: number): number {
  return b * Math.LN2;
}
