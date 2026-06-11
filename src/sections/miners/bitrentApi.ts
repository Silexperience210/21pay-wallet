// HTTP client for the CONFIRMED BitRent contract (source Silexperience210/bitrent,
// re-read 2026-06-11). Same IO discipline as casinoApi: reads are idempotent:true,
// anything that creates a payment/rental is idempotent:FALSE (never blind-retried);
// the JWT is module-scoped, injected ONLY into request headers, never logged and
// never part of a return value.
//
// Activation quirk (LOAD-BEARING): after the rental invoice is paid, the SERVER
// activates the physical miner inside `GET /api/rentals/status?id=` — the client
// must poll that endpoint (pollRentalUntilActive) or activation waits for the
// 30-second daemon sweep.
import { httpRequest } from '../../core/net';
import type { SectionCapabilities } from '../capabilities';
import { BITRENT_ORIGIN, isValidDuration, isValidPayoutAddress, type BitrentPoolId } from './bitrentConfig';

// Module-scoped session JWT (mirrors the casino session cookie discipline).
let authToken: string | null = null;

export function setAuthToken(token: string): void {
  authToken = token;
}
export function clearAuth(): void {
  authToken = null;
}
/** Only the session's PRESENCE is exposed, never the token. */
export function hasAuth(): boolean {
  return authToken != null;
}

function authHeaders(): Record<string, string> | undefined {
  return authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
}

// ── Types (confirmed response shapes) ─────────────────────────────────────────

export interface BitrentMiner {
  id: string;
  name: string;
  hashrate_ths: number;
  sats_per_minute: number;
  sats_per_hour: number;
  status: string;
  available: boolean;
  rental_end_time: string | null;
  uptime_percentage: string;
  last_checked: string | null;
  model: string;
  chips: number | null;
}

export interface BitrentRentalQuote {
  rental_id: string;
  invoice: string; // bolt11 — paid by the WALLET on an explicit CTA, never here
  payment_hash: string;
  amount_sats: number;
  expires_at: string;
}

export interface BitrentRentalSummary {
  id: string;
  status: string; // pending | active | completed
  miner_name: string;
  hashrate_ths: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  remaining_minutes: number;
  total_sats: number;
  pool_name: string | null;
  created_at: string;
}

export interface BitrentRentalStatus {
  id: string;
  status: string;
  miner: {
    id: string;
    name: string;
    hashrate_ths: number;
    last_hashrate: number | null;
    last_temp: number | null;
    last_power: number | null;
  };
  start_time: string;
  end_time: string;
  duration_minutes: number;
  elapsed_minutes: number;
  remaining_minutes: number;
  total_sats: number;
  mining_config: {
    pool_name?: string;
    pool_url?: string;
    payout_address?: string;
    stratum_user?: string;
  } | null;
}

// ── Auth (Nostr challenge-response → JWT, D-02) ───────────────────────────────

/** Full BitRent login via the master Nostr identity: challenge → NIP-98 sign
 *  (inside Core, via the capability seam) → verify → JWT stored module-side.
 *  Never throws raw to the boundary (CASINO-04-style layer 3 in callers). */
export async function loginWithNostr(caps: SectionCapabilities): Promise<boolean> {
  try {
    const pubkey = await caps.signer.getNostrPubkey();
    const ch = await httpRequest<{ challenge: string }>({
      baseUrl: BITRENT_ORIGIN,
      path: '/api/auth/challenge',
      method: 'POST',
      body: { pubkey },
      idempotent: false, // each call mints + rate-limits a challenge — don't blind-retry
    });
    const challenge = ch.data?.challenge;
    if (!challenge || !/^[0-9a-f]{64}$/i.test(challenge)) return false;
    const verifyUrl = `${BITRENT_ORIGIN}/api/auth/verify`;
    const event = await caps.signer.signNip98({ url: verifyUrl, method: 'POST', challenge });
    const res = await httpRequest<{ token?: string }>({
      baseUrl: BITRENT_ORIGIN,
      path: '/api/auth/verify',
      method: 'POST',
      body: { event },
      idempotent: false, // the challenge is consumed server-side on first attempt
    });
    if (!res.data?.token) return false;
    setAuthToken(res.data.token);
    return true;
  } catch {
    return false;
  }
}

// ── Browse (public, MINE-01) ──────────────────────────────────────────────────

/** GET /api/miners → online miners with prices + availability. */
export async function getMiners(): Promise<BitrentMiner[]> {
  const res = await httpRequest<{ miners: BitrentMiner[] }>({
    baseUrl: BITRENT_ORIGIN,
    path: '/api/miners',
    idempotent: true,
  });
  return res.data?.miners ?? [];
}

// ── Rent (MINE-02) ────────────────────────────────────────────────────────────

/** POST /api/rentals/create → the bolt11 quote. Bounds + payout address are
 *  validated with the server's EXACT rules BEFORE any request. The invoice is
 *  NEVER paid here (D-03) — the screen pays via caps.wallet on an explicit CTA. */
export async function createRental(opts: {
  minerId: string;
  durationMinutes: number;
  poolId: BitrentPoolId;
  payoutAddress: string;
  workerName?: string;
}): Promise<BitrentRentalQuote> {
  if (!isValidDuration(opts.durationMinutes)) {
    throw new Error('duration out of bounds (1-1440 minutes)');
  }
  if (!isValidPayoutAddress(opts.payoutAddress)) {
    throw new Error('invalid Bitcoin payout address');
  }
  const res = await httpRequest<BitrentRentalQuote>({
    baseUrl: BITRENT_ORIGIN,
    path: '/api/rentals/create',
    method: 'POST',
    body: {
      miner_id: opts.minerId,
      duration_minutes: opts.durationMinutes,
      pool_id: opts.poolId,
      payout_address: opts.payoutAddress,
      ...(opts.workerName ? { worker_name: opts.workerName } : {}),
    },
    headers: authHeaders(),
    idempotent: false, // creates a rental + invoice — NEVER blind-retried
  });
  return res.data;
}

// ── Dashboard (MINE-03) ───────────────────────────────────────────────────────

/** GET /api/rentals/list → the user's rentals (most recent first). */
export async function listRentals(): Promise<BitrentRentalSummary[]> {
  const res = await httpRequest<{ rentals: BitrentRentalSummary[] }>({
    baseUrl: BITRENT_ORIGIN,
    path: '/api/rentals/list',
    headers: authHeaders(),
    idempotent: true,
  });
  return res.data?.rentals ?? [];
}

/** GET /api/rentals/status?id= — ALSO the server-side payment-check/activation
 *  trigger while the rental is pending (load-bearing, see header note). */
export async function getRentalStatus(id: string): Promise<BitrentRentalStatus> {
  const res = await httpRequest<BitrentRentalStatus>({
    baseUrl: BITRENT_ORIGIN,
    path: `/api/rentals/status?id=${encodeURIComponent(id)}`,
    headers: authHeaders(),
    idempotent: true,
  });
  return res.data;
}

/** Confirmed live-stats shape (api/_lib/bitaxe.js getLiveStats; hashrate in GH/s). */
export interface BitrentLiveStats {
  hashrate?: number;
  temp?: number;
  bestSessionDiff?: number;
  bestDiff?: number;
  sharesAccepted?: number;
  sharesRejected?: number;
}

/** GET /api/rentals/status?id=&live=1 → live miner stats.
 *  502 = miner unreachable — surfaces as null, never an exception (D-07). */
export async function getLiveStats(id: string): Promise<BitrentLiveStats | null> {
  try {
    const res = await httpRequest<BitrentLiveStats>({
      baseUrl: BITRENT_ORIGIN,
      path: `/api/rentals/status?id=${encodeURIComponent(id)}&live=1`,
      headers: authHeaders(),
      idempotent: true,
    });
    return res.data ?? null;
  } catch {
    return null;
  }
}

/** Poll status until the rental leaves `pending` (the poll itself activates the
 *  miner server-side once the invoice settles). Fail-closed on timeout. */
export async function pollRentalUntilActive(
  id: string,
  opts?: { intervalMs?: number; maxAttempts?: number; sleep?: (ms: number) => Promise<void> },
): Promise<'active' | 'pending' | 'completed'> {
  const interval = opts?.intervalMs ?? 3000;
  const max = opts?.maxAttempts ?? 40; // ~2 minutes
  const sleep = opts?.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: 'active' | 'pending' | 'completed' = 'pending';
  for (let i = 0; i < max; i++) {
    try {
      const s = await getRentalStatus(id);
      if (s.status === 'active') return 'active';
      if (s.status === 'completed') return 'completed';
      last = 'pending';
    } catch {
      /* transient — keep polling */
    }
    if (i < max - 1) await sleep(interval);
  }
  return last;
}
