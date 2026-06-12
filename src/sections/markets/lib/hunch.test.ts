// Wire-format parsers — key cases ported from hunch-web's offline suite (which is
// itself cross-checked against the Rust `from_event` implementations).
//
// Run: `npx jest src/sections/markets/lib/hunch.test.ts`
import {
  KIND_MARKET,
  KIND_ORDER,
  KIND_ORACLE_ANNOUNCE,
  KIND_ORACLE_ATTESTATION,
  marketId,
  parseMarketEvent,
  parseOrderEvent,
  parseAnnounceEvent,
  parseAttestationEvent,
  aggregateReputation,
  canonicalSerialization,
  type NostrEvent,
  type Reputation,
} from './hunch';
import { buildOrderBook, impliedOdds } from './orderbook';
import { buildOrderTemplate, buildMarketTemplate } from './build';

const PK = 'a'.repeat(64);
const MID = marketId(PK, 'will-btc-100k');

function ev(partial: Partial<NostrEvent>): NostrEvent {
  return { id: 'i', pubkey: PK, created_at: 1, kind: 0, tags: [], content: '', sig: 's', ...partial };
}

const marketEvent = ev({
  kind: KIND_MARKET,
  tags: [
    ['d', 'will-btc-100k'],
    ['oracle', 'b'.repeat(64)],
    ['outcomes', 'YES,NO,INVALID'],
    ['expiry', '2000000000'],
    ['refund_timeout', '2000604800'],
    ['mint', 'https://mint-signet.21pay.org'],
    ['dlc_contract', 'hip-2'],
    ['t', 'bitcoin'],
  ],
  content: JSON.stringify({ question: 'BTC > 100k?', resolution_criteria: 'price', sources: [], rules_version: '1.0' }),
});

describe('hunch parsers (wire format)', () => {
  it('parses a full kind:30888 market', () => {
    const m = parseMarketEvent(marketEvent);
    expect(m).not.toBeNull();
    expect(m!.id).toBe(MID);
    expect(m!.oracle).toBe('b'.repeat(64));
    expect(m!.outcomes).toEqual(['YES', 'NO', 'INVALID']);
    expect(m!.content.question).toBe('BTC > 100k?');
  });

  it('rejects a market missing a required tag', () => {
    const bad = { ...marketEvent, tags: marketEvent.tags.filter((t) => t[0] !== 'oracle') };
    expect(parseMarketEvent(bad)).toBeNull();
  });

  it('parses a kind:38888 order and rejects a bad side', () => {
    const tpl = buildOrderTemplate({ market: MID, side: 'YES', amount: 1000, price: 65, kind: 'bid', expires: 2_000_000_000 });
    const o = parseOrderEvent(ev({ kind: KIND_ORDER, tags: tpl.tags }));
    expect(o).toMatchObject({ market: MID, side: 'YES', amount: 1000, price: 65, kind: 'bid' });
    const badTags = tpl.tags.map((t) => (t[0] === 'side' ? ['side', 'MAYBE'] : t));
    expect(parseOrderEvent(ev({ kind: KIND_ORDER, tags: badTags }))).toBeNull();
  });

  it('market template round-trips through parseMarketEvent (create path)', () => {
    const tpl = buildMarketTemplate({
      slug: 'btc-100k-x1',
      oracle: 'b'.repeat(64),
      expiry: 2_000_000_000,
      mint: 'https://mint-signet.21pay.org',
      dlcContract: 'hip-2',
      question: 'BTC > 100k?',
      resolution: 'closing price',
    });
    const m = parseMarketEvent(ev({ kind: KIND_MARKET, tags: tpl.tags, content: tpl.content }));
    expect(m).not.toBeNull();
    expect(m!.d).toBe('btc-100k-x1');
    expect(m!.outcomes).toEqual(['YES', 'NO', 'INVALID']);
    expect(m!.refundTimeout).toBe(2_000_000_000 + 7 * 24 * 3600); // expiry + 7d default
    expect(m!.content.question).toBe('BTC > 100k?');
  });

  it('order template round-trips and carries d == market (#d-filterable)', () => {
    const tpl = buildOrderTemplate({ market: MID, side: 'NO', amount: 10, price: 45, kind: 'bid', expires: 2_000_000_000 });
    expect(tpl.tags).toContainEqual(['d', MID]);
    expect(parseOrderEvent(ev({ kind: KIND_ORDER, tags: tpl.tags }))!.side).toBe('NO');
  });

  it('parses kind:88 announce (nonce 32B hex) and rejects bad nonces', () => {
    const a = parseAnnounceEvent(
      ev({ kind: KIND_ORACLE_ANNOUNCE, tags: [['market', MID], ['nonce', 'c'.repeat(64)]] }),
    );
    expect(a).toMatchObject({ market: MID, nonce: 'c'.repeat(64) });
    expect(
      parseAnnounceEvent(ev({ kind: KIND_ORACLE_ANNOUNCE, tags: [['market', MID], ['nonce', 'xyz']] })),
    ).toBeNull();
  });

  it('parses kind:89 attestation from the `sig` TAG (not content — Rust to_event_parts)', () => {
    const att = parseAttestationEvent(
      ev({
        kind: KIND_ORACLE_ATTESTATION,
        id: 'att-id',
        tags: [['market', MID], ['outcome', 'YES'], ['sig', 'd'.repeat(128)]],
        content: 'evidence here',
      }),
    );
    expect(att).toMatchObject({ market: MID, outcome: 'YES', signature: 'd'.repeat(128), eventId: 'att-id' });
    // sig in content only (the pre-fix bug shape) must NOT parse
    expect(
      parseAttestationEvent(
        ev({ kind: KIND_ORACLE_ATTESTATION, tags: [['market', MID], ['outcome', 'YES']], content: 'd'.repeat(128) }),
      ),
    ).toBeNull();
  });

  it('aggregateReputation keeps the newest claim per rater', () => {
    const rep = (rater: string, score: number, createdAt: number): Reputation => ({
      rater, target: 't'.repeat(32), scope: 'oracle', score, note: '', createdAt,
    });
    const sum = aggregateReputation([rep('r1', -50, 1), rep('r1', 100, 2), rep('r2', 0, 1)]);
    expect(sum).toEqual({ avg: 50, count: 2 });
  });

  it('canonicalSerialization is the compact NIP-01 array form', () => {
    expect(canonicalSerialization(ev({ kind: 1, content: 'hi' }))).toBe(
      `[0,"${PK}",1,1,[],"hi"]`,
    );
  });
});

describe('order book + implied odds', () => {
  const order = (side: 'YES' | 'NO', kind: 'bid' | 'ask', price: number) => ({
    author: PK, market: MID, side, amount: 1000, price, kind, expires: 2_000_000_000,
  });

  it('sorts bids high→low, asks low→high and surfaces best prices', () => {
    const book = buildOrderBook(
      [order('YES', 'bid', 60), order('YES', 'bid', 70), order('YES', 'ask', 80), order('NO', 'bid', 35)],
      MID,
    );
    expect(book.bestYesBid).toBe(70);
    expect(book.bestYesAsk).toBe(80);
    expect(book.bestNoBid).toBe(35);
    expect(book.yesBids.map((o) => o.price)).toEqual([70, 60]);
  });

  it('impliedOdds = pY/(pY+pN), null when one-sided', () => {
    const book = buildOrderBook([order('YES', 'bid', 70), order('NO', 'bid', 30)], MID);
    expect(impliedOdds(book)).toEqual({ yes: 70, no: 30 });
    expect(impliedOdds(buildOrderBook([order('YES', 'bid', 70)], MID))).toBeNull();
  });
});
