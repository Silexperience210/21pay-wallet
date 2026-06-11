// Order-book assembly — ported verbatim from hunch-web. Pure, offline-testable.
// Display-only; matching lives in the Rust `hunch-matcher`.
import type { Order } from './hunch';

export interface OrderBook {
  yesBids: Order[];
  yesAsks: Order[];
  noBids: Order[];
  noAsks: Order[];
  bestYesBid?: number;
  bestYesAsk?: number;
  bestNoBid?: number;
  bestNoAsk?: number;
}

const byPriceDesc = (a: Order, b: Order) => b.price - a.price;
const byPriceAsc = (a: Order, b: Order) => a.price - b.price;

/** Builds an order book from parsed orders, dropping any that don't reference `market`. */
export function buildOrderBook(orders: Order[], market?: string): OrderBook {
  const scoped = market ? orders.filter((o) => o.market === market) : orders;
  const pick = (side: 'YES' | 'NO', kind: 'bid' | 'ask') =>
    scoped.filter((o) => o.side === side && o.kind === kind);

  const yesBids = pick('YES', 'bid').sort(byPriceDesc);
  const yesAsks = pick('YES', 'ask').sort(byPriceAsc);
  const noBids = pick('NO', 'bid').sort(byPriceDesc);
  const noAsks = pick('NO', 'ask').sort(byPriceAsc);

  return {
    yesBids,
    yesAsks,
    noBids,
    noAsks,
    bestYesBid: yesBids[0]?.price,
    bestYesAsk: yesAsks[0]?.price,
    bestNoBid: noBids[0]?.price,
    bestNoAsk: noAsks[0]?.price,
  };
}

export interface ImpliedOdds {
  /** Implied P(YES) as an integer percent, 0..100. */
  yes: number;
  /** Implied P(NO); `yes + no === 100` by construction. */
  no: number;
}

/** Implied probability from the best bid on each side (complementary-pair economics:
 *  P(YES) = pY / (pY + pN)). Null with one-sided demand. */
export function impliedOdds(book: OrderBook): ImpliedOdds | null {
  const y = book.bestYesBid;
  const n = book.bestNoBid;
  if (y === undefined || n === undefined) return null;
  const total = y + n;
  if (total <= 0) return null;
  const yes = Math.round((y / total) * 100);
  return { yes, no: 100 - yes };
}
