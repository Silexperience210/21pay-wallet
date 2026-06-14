// Fetches a mint's HIP-1 announce (kind 30892) — ported from hunch-web/lib/mint.ts.
// The announce is mint-wide (no market tag): the mint's `d` tag is its mint id, which
// relays index, so we filter by `#d`. Each event is Schnorr-verified (relays untrusted);
// newest wins. Surfaces the reserves-proof URL + accepted oracles (HIP-3 transparency —
// non-optional per Hunch CLAUDE.md).
import { queryRelays, type RelayFilter } from './relay';
import { verifyEvent } from './verify';
import { KIND_MINT_ANNOUNCE, parseMintAnnounceEvent, type MintAnnounce } from './hunch';

/** Fetches the newest verified announce from the mint identified by `mintId`. */
export async function fetchMintAnnounce(
  relays: string[],
  mintId: string,
  limit = 50,
): Promise<MintAnnounce | null> {
  const filter: RelayFilter = { kinds: [KIND_MINT_ANNOUNCE], '#d': [mintId], limit };
  const events = await queryRelays(relays, filter);
  let best: MintAnnounce | null = null;
  let bestAt = -1;
  for (const ev of events) {
    if (!verifyEvent(ev)) continue;
    const m = parseMintAnnounceEvent(ev);
    if (!m || m.mintId !== mintId) continue;
    if (ev.created_at > bestAt) {
      best = m;
      bestAt = ev.created_at;
    }
  }
  return best;
}
