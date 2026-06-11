// HTTP client for the CONFIRMED satoshi-casino21 contract (RESEARCH O-1/O-2/O-4,
// source Silexemple/satoshi-casino21). Ports the custodialLnbits IO discipline onto
// core/net httpRequest, but authed by a session_id cookie (NOT X-Api-Key):
//  - reads are idempotent:true (auto-retry); payments are idempotent:FALSE (never
//    blind-retried — same discipline as custodialLnbits, T-05-12).
//  - the cookie is module-scoped, injected ONLY into request headers, never logged
//    and never part of a return value (T-05-11).
//  - the casino balance is SECTION-owned; callers must never write it to the wallet
//    store (D-04 / CASINO-02, T-05-13).
import { httpRequest } from '../../core/net';
import { CASINO_ORIGIN, DEPOSIT_MIN_SAT, DEPOSIT_MAX_SAT } from './casinoConfig';

// Module-scoped session (mirrors the module-scoped `active` in walletProvider).
let sessionCookie: string | null = null;

export function setSessionCookie(cookie: string): void {
  sessionCookie = cookie;
}

export function clearSession(): void {
  sessionCookie = null;
}

/** The session is held privately; only its presence is exposed. */
export function hasSession(): boolean {
  return sessionCookie != null;
}

function cookieHeaders(): Record<string, string> | undefined {
  return sessionCookie ? { Cookie: `session_id=${sessionCookie}` } : undefined;
}

// ── Auth (LNURL-auth LUD-04 — the app signs k1 internally via core/keys) ──────

/** GET /api/auth/generate → { lnurl } (bech32 LNURL carrying the k1 challenge). */
export async function generateAuthUrl(): Promise<{ lnurl: string }> {
  const res = await httpRequest<{ lnurl: string }>({
    baseUrl: CASINO_ORIGIN,
    path: '/api/auth/generate',
    headers: cookieHeaders(),
    idempotent: true,
  });
  return res.data;
}

/** GET /api/auth/callback?tag=login&k1=&sig=&key= — submits the LUD-04 signature. */
export async function authCallback(k1: string, sig: string, key: string): Promise<void> {
  await httpRequest<{ status?: string }>({
    baseUrl: CASINO_ORIGIN,
    path: `/api/auth/callback?tag=login&k1=${k1}&sig=${sig}&key=${key}`,
    headers: cookieHeaders(),
    idempotent: true,
  });
}

export interface AuthStatus {
  status: 'pending' | 'expired' | string;
  session_id?: string;
  player?: unknown;
}

/** GET /api/auth/status?k1= → pending/expired, or the minted session.
 *  (The casino sets an HttpOnly Set-Cookie; since core/net doesn't expose response
 *  headers, the session id is read from the JSON body where the API returns it.) */
export async function authStatus(k1: string): Promise<AuthStatus> {
  const res = await httpRequest<AuthStatus>({
    baseUrl: CASINO_ORIGIN,
    path: `/api/auth/status?k1=${k1}`,
    idempotent: true,
  });
  return res.data;
}

/** Poll auth status until the session is minted, or fail-closed on expiry/timeout.
 *  On success the session cookie is stored module-side (never returned). */
export async function pollAuthStatus(
  k1: string,
  opts?: { intervalMs?: number; maxAttempts?: number },
): Promise<'authenticated' | 'expired'> {
  const interval = opts?.intervalMs ?? 2000;
  const max = opts?.maxAttempts ?? 60;
  for (let i = 0; i < max; i++) {
    const s = await authStatus(k1);
    if (s.session_id) {
      setSessionCookie(s.session_id);
      return 'authenticated';
    }
    if (s.status === 'expired') return 'expired';
    await new Promise((r) => setTimeout(r, interval));
  }
  return 'expired'; // fail-closed on timeout
}

// ── Money (CASINO-02) ─────────────────────────────────────────────────────────

/** POST /api/deposit { amount } → { payment_hash, payment_request }. Bounds are
 *  validated BEFORE any request (1000..100000, confirmed contract). The returned
 *  BOLT11 is paid by the WALLET (core.wallet.payInvoice) — never auto-paid here. */
export async function deposit(amountSat: number): Promise<{ payment_hash: string; payment_request: string }> {
  if (!Number.isInteger(amountSat) || amountSat < DEPOSIT_MIN_SAT || amountSat > DEPOSIT_MAX_SAT) {
    throw new Error(`deposit amount out of bounds (${DEPOSIT_MIN_SAT}-${DEPOSIT_MAX_SAT} sats)`);
  }
  const res = await httpRequest<{ payment_hash: string; payment_request: string }>({
    baseUrl: CASINO_ORIGIN,
    path: '/api/deposit',
    method: 'POST',
    body: { amount: amountSat },
    headers: cookieHeaders(),
    idempotent: false, // a payment-creating call is NEVER blind-retried
  });
  return res.data;
}

/** GET /api/check-payment/<hash> → { paid } — poll until the deposit credits. */
export async function checkPayment(paymentHash: string): Promise<{ paid: boolean }> {
  const res = await httpRequest<{ paid: boolean }>({
    baseUrl: CASINO_ORIGIN,
    path: `/api/check-payment/${paymentHash}`,
    headers: cookieHeaders(),
    idempotent: true,
  });
  return res.data;
}

/** POST /api/withdraw { invoice } — the WALLET creates the invoice; the casino pays
 *  it (fee reserve max(1%, 10 sats) per the confirmed contract). */
export async function withdraw(invoice: string): Promise<void> {
  await httpRequest<Record<string, unknown>>({
    baseUrl: CASINO_ORIGIN,
    path: '/api/withdraw',
    method: 'POST',
    body: { invoice },
    headers: cookieHeaders(),
    idempotent: false, // payout — never blind-retried
  });
}

/** GET /api/balance → { balance } (sats). SECTION-owned — keep distinct from the
 *  wallet balance; never write it to the wallet store (D-04). */
export async function getBalance(): Promise<{ balance: number }> {
  const res = await httpRequest<{ balance: number }>({
    baseUrl: CASINO_ORIGIN,
    path: '/api/balance',
    headers: cookieHeaders(),
    idempotent: true,
  });
  return res.data;
}
