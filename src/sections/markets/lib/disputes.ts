// Fetches HIP-1 disputes (kind 30890) for a market — ported from hunch-web/lib/disputes.ts.
// The dispute's `d` tag is the market id, so disputes are relay-indexed and we filter by
// `#d`. Each event is Schnorr-verified (relays untrusted); disputes are parameterized-
// replaceable, so we keep the newest claim per disputer.
import { queryRelays, type RelayFilter } from './relay';
import { verifyEvent } from './verify';
import { KIND_DISPUTE, parseDisputeEvent, type Dispute } from './hunch';

/** Fetches the latest verified dispute per disputer for `market`. */
export async function fetchDisputes(relays: string[], market: string, limit = 200): Promise<Dispute[]> {
  const filter: RelayFilter = { kinds: [KIND_DISPUTE], '#d': [market], limit };
  const events = await queryRelays(relays, filter);
  const newest = new Map<string, Dispute>();
  for (const ev of events) {
    if (!verifyEvent(ev)) continue;
    const dispute = parseDisputeEvent(ev);
    if (!dispute || dispute.market !== market) continue;
    const prev = newest.get(dispute.disputer);
    if (!prev || dispute.createdAt > prev.createdAt) newest.set(dispute.disputer, dispute);
  }
  return [...newest.values()];
}
