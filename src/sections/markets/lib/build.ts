// Event templates for the write path — ported from hunch-web (mirrors hunch-cli's
// build_market / order tags). Pure tag/content assembly; signing happens via the
// Core Signer capability (signer.signHunchEvent), never here.
import { KIND_MARKET, KIND_ORDER, OUTCOMES } from './hunch';

const SEVEN_DAYS = 7 * 24 * 3600;

export interface EventTemplate {
  kind: number;
  tags: string[][];
  content: string;
}

export interface MarketParams {
  slug: string;
  oracle: string;
  expiry: number;
  refundTimeout?: number;
  mint: string;
  dlcContract: string;
  question: string;
  resolution?: string;
  sources?: string[];
  rulesVersion?: string;
  category?: string;
  topics?: string[];
}

/** Unsigned kind:30888 market template. Outcomes are the HIP-2 canonical set;
 *  refund_timeout defaults to expiry + 7 days (hunch-cli default). */
export function buildMarketTemplate(p: MarketParams): EventTemplate {
  const refund = p.refundTimeout ?? p.expiry + SEVEN_DAYS;
  const tags: string[][] = [
    ['d', p.slug],
    ['oracle', p.oracle],
    ['outcomes', OUTCOMES.join(',')],
    ['expiry', String(p.expiry)],
    ['refund_timeout', String(refund)],
    ['mint', p.mint],
    ['dlc_contract', p.dlcContract],
  ];
  if (p.category) tags.push(['category', p.category]);
  for (const t of p.topics ?? []) tags.push(['t', t]);

  const content = JSON.stringify({
    question: p.question,
    resolution_criteria: p.resolution ?? '',
    sources: p.sources ?? [],
    rules_version: p.rulesVersion ?? '1.0',
  });
  return { kind: KIND_MARKET, tags, content };
}

export interface OrderParams {
  market: string;
  side: 'YES' | 'NO';
  amount: number;
  price: number;
  kind: 'bid' | 'ask';
  expires: number;
}

/** Unsigned kind:38888 order template, with `d` == market (addressable + #d-filterable). */
export function buildOrderTemplate(p: OrderParams): EventTemplate {
  return {
    kind: KIND_ORDER,
    tags: [
      ['market', p.market],
      ['side', p.side],
      ['amount', String(p.amount)],
      ['price', String(p.price)],
      ['kind', p.kind],
      ['expires', String(p.expires)],
      ['d', p.market],
    ],
    content: '',
  };
}
