// Position persistence (MARKET-04) — via the section store capability ONLY
// (constraint 5). Non-secret metadata + LOCKED proofs live in the prefs store:
// locked proofs are unspendable without the bettor secret `b`, which lives
// separately in the secure store, keyed per position (D-03).
import type { SectionCapabilities } from '../capabilities';
import type { Proof } from './lib/wallet';

export type PositionStatus = 'open' | 'won' | 'lost' | 'refunded';

export interface BetPosition {
  id: string;
  marketId: string;
  question: string;
  outcome: 'YES' | 'NO';
  amountSat: number;
  mintUrl: string;
  oracle: string;
  /** The announce nonce R the lock key was derived from (settlement needs the same R). */
  nonce: string;
  /** Refund locktime (unix seconds) — after this, `b` alone can reclaim (INVALID/silence). */
  locktime: number;
  proofs: Proof[];
  createdAt: number;
  status: PositionStatus;
  redeemedSat?: number;
  /** True once `proofs` hold the UNLOCKED (post-redeem) tokens: the redeem step is
   *  done and only the melt remains. Makes settlement retry-safe — a melt failure
   *  after a successful redeem must never lose the unlocked proofs. */
  unlockedProofs?: boolean;
}

const POSITIONS_KEY = 'markets.positions';
const secretKey = (positionId: string) => `markets.b.${positionId}`;

export async function loadPositions(caps: SectionCapabilities): Promise<BetPosition[]> {
  try {
    const raw = await caps.store.get(POSITIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BetPosition[]) : [];
  } catch {
    return [];
  }
}

export async function savePositions(caps: SectionCapabilities, positions: BetPosition[]): Promise<void> {
  await caps.store.set(POSITIONS_KEY, JSON.stringify(positions));
}

export async function addPosition(caps: SectionCapabilities, position: BetPosition, bettorSecret: string): Promise<void> {
  await caps.store.setSecret(secretKey(position.id), bettorSecret);
  const all = await loadPositions(caps);
  all.unshift(position);
  await savePositions(caps, all);
}

export async function loadBettorSecret(caps: SectionCapabilities, positionId: string): Promise<string | null> {
  return caps.store.getSecret(secretKey(positionId));
}

/** Remove a position entirely — ONLY for aborted stakes where no payment left the
 *  wallet (the pay call itself failed). Never use once sats moved. */
export async function removePosition(caps: SectionCapabilities, positionId: string): Promise<void> {
  const all = await loadPositions(caps);
  await savePositions(caps, all.filter((p) => p.id !== positionId));
  await caps.store.deleteSecret(secretKey(positionId)).catch(() => {});
}

export async function updatePosition(
  caps: SectionCapabilities,
  positionId: string,
  patch: Partial<BetPosition>,
): Promise<void> {
  const all = await loadPositions(caps);
  const idx = all.findIndex((p) => p.id === positionId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  await savePositions(caps, all);
  // Only a REDEEMED position no longer needs its stake key. 'lost' keeps `b`:
  // the NUT-11 refund branch (refundKeys=[B] after locktime) still reclaims the
  // locked stake once the refund timeout passes (HIP-3 refund fallback).
  if (patch.status === 'won' || patch.status === 'refunded') {
    await caps.store.deleteSecret(secretKey(positionId)).catch(() => {});
  }
}
