// Hunch protocol — client core, PORTED from apps/hunch-web/lib/hunch.ts (which mirrors
// the Rust `hunch-protocol` / `hunch-nostr`, byte-for-byte verified in Hunch CI).
// Zero dependencies: pure parsing + the canonical NIP-01 serialization. Schnorr
// verification lives in ./verify (relays are untrusted).

export const KIND_MARKET = 30888;
export const KIND_ORDER = 38888;
export const KIND_ORACLE_ANNOUNCE = 88;
export const KIND_ORACLE_ATTESTATION = 89;
export const KIND_REPUTATION = 30891;
export const KIND_DISPUTE = 30890;

/** The HIP-2 canonical outcomes, in order. */
export const OUTCOMES = ['YES', 'NO', 'INVALID'] as const;

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** HIP-1 market identifier: `<creator_pubkey>:30888:<d>`. */
export function marketId(creatorPubkey: string, d: string): string {
  return `${creatorPubkey}:${KIND_MARKET}:${d}`;
}

function tagValue(tags: string[][], name: string): string | undefined {
  return tags.find((t) => t[0] === name)?.[1];
}

function tagValues(tags: string[][], name: string): string[] {
  return tags.filter((t) => t[0] === name).map((t) => t[1]).filter((v): v is string => v != null);
}

export interface MarketContent {
  question: string;
  resolution_criteria: string;
  sources: string[];
  rules_version: string;
}

export interface Market {
  id: string;
  creator: string;
  d: string;
  oracle: string;
  outcomes: string[];
  expiry: number;
  refundTimeout: number;
  mint: string;
  dlcContract: string;
  category?: string;
  image?: string;
  topics: string[];
  content: MarketContent;
}

/** Parses a kind:30888 event into a Market, or returns null if malformed. */
export function parseMarketEvent(ev: NostrEvent): Market | null {
  if (ev.kind !== KIND_MARKET) return null;
  const d = tagValue(ev.tags, 'd');
  const oracle = tagValue(ev.tags, 'oracle');
  const outcomesRaw = tagValue(ev.tags, 'outcomes');
  const expiry = tagValue(ev.tags, 'expiry');
  const refundTimeout = tagValue(ev.tags, 'refund_timeout');
  const mint = tagValue(ev.tags, 'mint');
  const dlcContract = tagValue(ev.tags, 'dlc_contract');
  if (!d || !oracle || !outcomesRaw || !expiry || !refundTimeout || !mint || !dlcContract) return null;

  let content: MarketContent;
  try {
    content = JSON.parse(ev.content);
  } catch {
    return null;
  }
  if (typeof content?.question !== 'string') return null;

  return {
    id: marketId(ev.pubkey, d),
    creator: ev.pubkey,
    d,
    oracle,
    outcomes: outcomesRaw.split(',').map((s) => s.trim()),
    expiry: Number(expiry),
    refundTimeout: Number(refundTimeout),
    mint,
    dlcContract,
    category: tagValue(ev.tags, 'category'),
    image: tagValue(ev.tags, 'image'),
    topics: tagValues(ev.tags, 't'),
    content: {
      question: content.question,
      resolution_criteria: content.resolution_criteria ?? '',
      sources: Array.isArray(content.sources) ? content.sources : [],
      rules_version: content.rules_version ?? '',
    },
  };
}

export interface Order {
  author: string;
  market: string;
  side: 'YES' | 'NO';
  amount: number;
  price: number;
  kind: 'bid' | 'ask';
  expires: number;
}

/** Parses a kind:38888 event into an Order, or returns null if malformed. */
export function parseOrderEvent(ev: NostrEvent): Order | null {
  if (ev.kind !== KIND_ORDER) return null;
  const market = tagValue(ev.tags, 'market');
  const side = tagValue(ev.tags, 'side');
  const amount = tagValue(ev.tags, 'amount');
  const price = tagValue(ev.tags, 'price');
  const kind = tagValue(ev.tags, 'kind');
  const expires = tagValue(ev.tags, 'expires');
  if (!market || !amount || !price || !expires) return null;
  if (side !== 'YES' && side !== 'NO') return null;
  if (kind !== 'bid' && kind !== 'ask') return null;
  return {
    author: ev.pubkey,
    market,
    side,
    amount: Number(amount),
    price: Number(price),
    kind,
    expires: Number(expires),
  };
}

export interface OracleAnnounce {
  market: string;
  /** The oracle's announced public nonce R (x-only hex, 32 bytes). */
  nonce: string;
  body: string;
}

/** Parses a kind:88 NIP-88 announce (mirrors `OracleAnnounce::from_event`). */
export function parseAnnounceEvent(ev: NostrEvent): OracleAnnounce | null {
  if (ev.kind !== KIND_ORACLE_ANNOUNCE) return null;
  const market = tagValue(ev.tags, 'market');
  const nonce = tagValue(ev.tags, 'nonce');
  if (!market || !nonce) return null;
  if (!/^[0-9a-f]{64}$/i.test(nonce)) return null; // 32-byte hex
  return { market, nonce: nonce.toLowerCase(), body: ev.content };
}

export interface OracleAttestation {
  market: string;
  outcome: string;
  /** The DLC attestation signature (BIP-340 with the pre-committed nonce), 64-byte hex. */
  signature: string;
  /** The kind:89 event id (referenced by disputes). */
  eventId: string;
  evidence: string;
}

/** Parses a kind:89 NIP-88 attestation. NOTE: the signature lives in the `sig` TAG
 *  (not the content — see Rust `OracleAttestation::to_event_parts`). */
export function parseAttestationEvent(ev: NostrEvent): OracleAttestation | null {
  if (ev.kind !== KIND_ORACLE_ATTESTATION) return null;
  const market = tagValue(ev.tags, 'market');
  const outcome = tagValue(ev.tags, 'outcome');
  const signature = tagValue(ev.tags, 'sig')?.trim();
  if (!market || !outcome || !signature) return null;
  if (!(OUTCOMES as readonly string[]).includes(outcome)) return null;
  if (!/^[0-9a-f]{128}$/i.test(signature)) return null; // 64-byte hex
  return { market, outcome, signature: signature.toLowerCase(), eventId: ev.id, evidence: (ev.content ?? '').trim() };
}

/** HIP-5 reputation scopes (mirrors `ReputationScope`). */
export const REPUTATION_SCOPES = ['oracle', 'mint', 'market_creator', 'bettor'] as const;
export type ReputationScope = (typeof REPUTATION_SCOPES)[number];

export interface Reputation {
  rater: string;
  /** The rated pubkey — the `p` tag (x-only hex, 32 bytes). */
  target: string;
  scope: ReputationScope;
  /** Score in [-100, +100] (HIP-5). */
  score: number;
  market?: string;
  note: string;
  createdAt: number;
}

/** Parses a kind:30891 HIP-5 reputation claim (mirrors `Reputation::from_event`). */
export function parseReputationEvent(ev: NostrEvent): Reputation | null {
  if (ev.kind !== KIND_REPUTATION) return null;
  const target = tagValue(ev.tags, 'p');
  const scope = tagValue(ev.tags, 'scope');
  const scoreRaw = tagValue(ev.tags, 'score');
  if (!target || !scope || scoreRaw == null) return null;
  if (!/^[0-9a-f]{64}$/i.test(target)) return null;
  if (!(REPUTATION_SCOPES as readonly string[]).includes(scope)) return null;
  const score = Number(scoreRaw);
  if (!Number.isInteger(score) || score < -100 || score > 100) return null;
  return {
    rater: ev.pubkey,
    target: target.toLowerCase(),
    scope: scope as ReputationScope,
    score,
    market: tagValue(ev.tags, 'market'),
    note: ev.content,
    createdAt: ev.created_at,
  };
}

export interface ReputationSummary {
  avg: number;
  count: number;
}

/** Mean score + rater count, keeping the newest claim per rater. */
export function aggregateReputation(reps: Reputation[]): ReputationSummary | null {
  const byRater = new Map<string, Reputation>();
  for (const r of reps) {
    const prev = byRater.get(r.rater);
    if (!prev || r.createdAt > prev.createdAt) byRater.set(r.rater, r);
  }
  if (byRater.size === 0) return null;
  const vals = [...byRater.values()].map((r) => r.score);
  return { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), count: byRater.size };
}

/** Canonical NIP-01 serialization string used for the event id. */
export function canonicalSerialization(
  ev: Pick<NostrEvent, 'pubkey' | 'created_at' | 'kind' | 'tags' | 'content'>,
): string {
  return JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]);
}
