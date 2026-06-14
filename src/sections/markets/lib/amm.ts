// AMM quote layer over the LMSR core (./lmsr) — ported from hunch-web/lib/amm.ts.
// Turns a market's current probability into an instant, 1-click bettable price. The
// mint acts as market maker: it always quotes a YES/NO price that moves with the size
// of your bet (slippage), with worst-case subsidy bounded by b·ln2.
//
// This is the AMM half of Hunch's hybrid AMM+CLOB design: the order book (./orderbook)
// still carries resting limit orders, while the AMM gives instant liquidity so no
// market is ever un-bettable on day one. Pricing is anchored on the book's implied
// probability when there is two-sided demand, else 50/50. The actual bet still uses
// the proven deposit→mintLocked→redeem path (betFlow).
//
// All pure + offline-tested.
import { costToBuy, priceYes as lmsrPriceYes } from './lmsr';

/** Default liquidity depth in sats. Worst-case market-maker subsidy is b·ln2 ≈ 0.69·b. */
export const DEFAULT_DEPTH = 10_000;

/** Maker fee in basis points (the operator's rake), kept in sync with the Rust `hunch-mm` pool. */
export const MAKER_FEE_BPS = 200;

/**
 * Net YES inventory (with qNo = 0) that makes the LMSR price equal probability `p` (0..1).
 * priceYes(q, 0, b) = 1/(1 + e^(−q/b)) = p  ⇒  q = b·ln(p/(1−p)).
 */
export function inventoryForProb(p: number, b: number): number {
  const eps = 1e-6;
  const pc = Math.min(1 - eps, Math.max(eps, p));
  return b * Math.log(pc / (1 - pc));
}

export interface Quote {
  /** Instant price (= probability) of each side *before* your bet, 0..1. */
  priceYes: number;
  priceNo: number;
  /** Payout in sats you receive if your side wins, for the given stake. */
  shares: number;
  /** Average price paid per share (stake / shares), 0..1. */
  avgPrice: number;
  /** Price of your side *after* the bet, 0..1 — shows the slippage you moved the market by. */
  priceAfter: number;
  /** Maker fee (operator rake) included in the stake, in sats. */
  fee: number;
}

/** Invert costToBuy: how many shares `stake` sats buys on `side`. Bisection (cost is monotone). */
export function sharesForStake(side: 'YES' | 'NO', stake: number, qYes: number, qNo: number, b: number): number {
  if (stake <= 0) return 0;
  let lo = 0;
  let hi = Math.max(1, stake);
  // A share costs < 1 sat (price < 1), so `stake` sats always buys > `stake` shares — grow hi until
  // it overshoots, then bisect.
  while (costToBuy(side, hi, qYes, qNo, b) < stake) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (costToBuy(side, mid, qYes, qNo, b) < stake) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Quote a 1-click bet: you pay `stake` sats on `side`; returns the instant prices, the payout-if-win,
 * the post-trade price (slippage), and the maker fee taken out of the stake. `p` is the current
 * P(YES) anchor (e.g. order-book implied odds), `b` the liquidity depth, `feeBps` the maker fee.
 *
 * The fee is taken off the top: `stake = fairBudget·(1 + feeRate)`, so the bettor buys shares worth
 * `fairBudget` at the fair LMSR price and `fee = stake − fairBudget` is the operator's rake — exactly
 * matching the Rust `hunch-mm` pool.
 */
export function quoteBet(
  side: 'YES' | 'NO',
  stake: number,
  p: number,
  b: number,
  feeBps: number = MAKER_FEE_BPS,
): Quote {
  const qYes = inventoryForProb(p, b);
  const qNo = 0;
  const priceYes = lmsrPriceYes(qYes, qNo, b);
  const priceNo = 1 - priceYes;
  const feeRate = feeBps / 10_000;
  const fairBudget = stake / (1 + feeRate);
  const fee = stake - fairBudget;
  const shares = sharesForStake(side, fairBudget, qYes, qNo, b);
  const avgPrice = shares > 0 ? stake / shares : side === 'YES' ? priceYes : priceNo;
  const priceAfter =
    side === 'YES' ? lmsrPriceYes(qYes + shares, qNo, b) : 1 - lmsrPriceYes(qYes, qNo + shares, b);
  return { priceYes, priceNo, shares, avgPrice, priceAfter, fee };
}
