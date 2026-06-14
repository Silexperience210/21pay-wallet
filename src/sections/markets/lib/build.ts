// Event templates for the write path — ported from hunch-web (mirrors hunch-cli's
// build_market / order tags). Pure tag/content assembly; signing happens via the
// Core Signer capability (signer.signHunchEvent), never here.
import { KIND_DISPUTE, KIND_MARKET, KIND_ORDER, KIND_REPUTATION, OUTCOMES, type ReputationScope } from './hunch';

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
  /** Optional connector resolution spec (JSON string) for oracle auto-resolution. */
  resolutionSpec?: string;
}

/** Unsigned NIP-09 deletion (kind:5) for a market — only valid signed by its creator.
 *  Targets the addressable 30888 event via an `a` tag. */
export function buildDeleteTemplate(creator: string, d: string): EventTemplate {
  return {
    kind: 5,
    tags: [
      ['a', `${KIND_MARKET}:${creator}:${d}`],
      ['k', String(KIND_MARKET)],
    ],
    content: 'market deleted by creator',
  };
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
  if (p.resolutionSpec) tags.push(['resolution_spec', p.resolutionSpec]);
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

export interface ReputationInput {
  /** Pubkey being rated (x-only hex) — the `p` tag. */
  subject: string;
  /** What is being rated (default "oracle"). */
  scope?: ReputationScope;
  /** Score in [-100, +100]. */
  score: number;
  /** Optional market this claim is scoped to. */
  market?: string;
  /** Free-form justification. */
  note?: string;
}

/** Unsigned kind:30891 reputation claim (mirrors `Reputation::to_event_parts`).
 *  `d` == `<scope>:<subject>` (one replaceable claim per rater per target+scope); the
 *  rated pubkey is the `p` tag (relay-indexed, so clients filter by `#p`). */
export function buildReputationTemplate(input: ReputationInput): EventTemplate {
  const scope = input.scope ?? 'oracle';
  const tags: string[][] = [
    ['d', `${scope}:${input.subject}`],
    ['p', input.subject],
    ['scope', scope],
    ['score', String(input.score)],
  ];
  if (input.market) tags.push(['market', input.market]);
  return { kind: KIND_REPUTATION, tags, content: input.note ?? '' };
}

export interface DisputeInput {
  /** Market being disputed (`<creator>:30888:<d>`). */
  market: string;
  /** Event id of the disputed kind:89 attestation. */
  attestation: string;
  /** Short claim category, e.g. `oracle_misread`, `source_unavailable`. */
  claim: string;
  /** Free-form evidence body. */
  evidence?: string;
}

/** Unsigned kind:30890 dispute (mirrors `Dispute::to_event_parts`). `d` == market, so a
 *  disputer holds one replaceable dispute per market and clients filter by `#d`. */
export function buildDisputeTemplate(input: DisputeInput): EventTemplate {
  return {
    kind: KIND_DISPUTE,
    tags: [
      ['d', input.market],
      ['market', input.market],
      ['attestation', input.attestation],
      ['claim', input.claim],
    ],
    content: input.evidence ?? '',
  };
}
