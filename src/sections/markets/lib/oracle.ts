// Oracle reads — ported from hunch-web. The `market` tag is multi-character so relays
// don't index it (NIP-01 indexes single-letter tags only): filter by authors+kind
// (indexed) and match the market tag client-side. Every event is Schnorr-verified
// (relays untrusted); the newest valid match wins.
import { queryRelays, type RelayFilter } from './relay';
import { verifyEvent } from './verify';
import {
  KIND_ORACLE_ANNOUNCE,
  KIND_ORACLE_ATTESTATION,
  KIND_REPUTATION,
  parseAnnounceEvent,
  parseAttestationEvent,
  parseReputationEvent,
  type NostrEvent,
  type OracleAnnounce,
  type OracleAttestation,
  type Reputation,
  type ReputationScope,
} from './hunch';

/** Picks the verified, market-matching, parseable event with the greatest created_at. */
function newestMatch<T>(
  events: NostrEvent[],
  parse: (ev: NostrEvent) => T | null,
  marketOf: (parsed: T) => string,
  market: string,
): T | null {
  let best: T | null = null;
  let bestAt = -1;
  for (const ev of events) {
    if (!verifyEvent(ev)) continue;
    const parsed = parse(ev);
    if (!parsed || marketOf(parsed) !== market) continue;
    if (ev.created_at > bestAt) {
      best = parsed;
      bestAt = ev.created_at;
    }
  }
  return best;
}

/** The oracle's latest announce for `market` (carries the nonce R), or null. */
export async function fetchAnnounce(
  relays: string[],
  oraclePubkey: string,
  market: string,
  limit = 200,
): Promise<OracleAnnounce | null> {
  const filter: RelayFilter = { kinds: [KIND_ORACLE_ANNOUNCE], authors: [oraclePubkey], limit };
  const events = await queryRelays(relays, filter);
  return newestMatch(events, parseAnnounceEvent, (a) => a.market, market);
}

/** The oracle's latest attestation for `market` (the settlement), or null. */
export async function fetchAttestation(
  relays: string[],
  oraclePubkey: string,
  market: string,
  limit = 200,
): Promise<OracleAttestation | null> {
  const filter: RelayFilter = { kinds: [KIND_ORACLE_ATTESTATION], authors: [oraclePubkey], limit };
  const events = await queryRelays(relays, filter);
  return newestMatch(events, parseAttestationEvent, (a) => a.market, market);
}

/** All verified reputation claims about `subjectPubkey` for a scope (`#p` IS indexed). */
export async function fetchReputation(
  relays: string[],
  subjectPubkey: string,
  scope: ReputationScope = 'oracle',
  limit = 500,
): Promise<Reputation[]> {
  const filter: RelayFilter = { kinds: [KIND_REPUTATION], '#p': [subjectPubkey], limit };
  const events = await queryRelays(relays, filter);
  const out: Reputation[] = [];
  for (const ev of events) {
    if (!verifyEvent(ev)) continue;
    const rep = parseReputationEvent(ev);
    if (rep && rep.target === subjectPubkey && rep.scope === scope) out.push(rep);
  }
  return out;
}
