// Confirmed satoshi-casino21 HTTP contract via mocked httpRequest (CASINO-02).
// GREEN in 05-04 Task 3 (MANDATORY). The cookie value is auth and must NEVER appear
// in a return value — only injected into request headers.
//
// Run: `npx jest src/sections/casino/casinoApi.test.ts`
jest.mock('../../core/net', () => ({ httpRequest: jest.fn() }));

import { httpRequest } from '../../core/net';
import {
  generateAuthUrl,
  authStatus,
  authCallback,
  pollAuthStatus,
  deposit,
  checkPayment,
  withdraw,
  getBalance,
  setSessionCookie,
  clearSession,
  hasSession,
} from './casinoApi';
import { CASINO_ORIGIN } from './casinoConfig';

// ---------------------------------------------------------------------------
// CONFIRMED contract fixtures (from the 05-01 RED stub — unchanged).
// ---------------------------------------------------------------------------
export const EXPECTED_DEPOSIT_MIN_SAT = 1000;
export const EXPECTED_DEPOSIT_MAX_SAT = 100000;
export const SAMPLE_SESSION = 'abc';
export const EXPECTED_COOKIE_HEADER = `session_id=${SAMPLE_SESSION}`;
export const SAMPLE_DEPOSIT_AMOUNT = 50000;
export const SAMPLE_WITHDRAW_INVOICE = 'lnbc500u1pjwithdrawxxx';
export const SAMPLE_PAYMENT_HASH = 'a'.repeat(64);
export const SAMPLE_K1 = 'f'.repeat(64);

const mockHttp = httpRequest as jest.Mock;
const lastCall = () => mockHttp.mock.calls[mockHttp.mock.calls.length - 1][0];

beforeEach(() => {
  mockHttp.mockReset().mockResolvedValue({ status: 200, data: {} });
  clearSession();
});

describe('casinoApi — confirmed contract via mocked httpRequest (CASINO-02)', () => {
  it('generateAuthUrl() calls GET /api/auth/generate (idempotent: true)', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: { lnurl: 'lnurl1xyz' } });
    const r = await generateAuthUrl();
    expect(lastCall()).toMatchObject({ baseUrl: CASINO_ORIGIN, path: '/api/auth/generate', idempotent: true });
    expect(r.lnurl).toBe('lnurl1xyz');
  });

  it('authStatus(k1) calls GET /api/auth/status?k1=<64hex> (idempotent: true)', async () => {
    await authStatus(SAMPLE_K1);
    expect(lastCall()).toMatchObject({ path: `/api/auth/status?k1=${SAMPLE_K1}`, idempotent: true });
  });

  it('deposit(50000) calls POST /api/deposit with body { amount: 50000 } and idempotent: false', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: { payment_hash: 'h', payment_request: 'lnbc1' } });
    await deposit(SAMPLE_DEPOSIT_AMOUNT);
    expect(lastCall()).toMatchObject({
      baseUrl: CASINO_ORIGIN,
      path: '/api/deposit',
      method: 'POST',
      body: { amount: SAMPLE_DEPOSIT_AMOUNT },
      idempotent: false,
    });
  });

  it('checkPayment(hash) calls GET /api/check-payment/<hash> (idempotent: true)', async () => {
    await checkPayment(SAMPLE_PAYMENT_HASH);
    expect(lastCall()).toMatchObject({ path: `/api/check-payment/${SAMPLE_PAYMENT_HASH}`, idempotent: true });
  });

  it('withdraw(invoice) calls POST /api/withdraw with body { invoice } and idempotent: false', async () => {
    await withdraw(SAMPLE_WITHDRAW_INVOICE);
    expect(lastCall()).toMatchObject({
      path: '/api/withdraw',
      method: 'POST',
      body: { invoice: SAMPLE_WITHDRAW_INVOICE },
      idempotent: false,
    });
  });

  it('getBalance() calls GET /api/balance (idempotent: true)', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: { balance: 42000 } });
    const r = await getBalance();
    expect(lastCall()).toMatchObject({ path: '/api/balance', idempotent: true });
    expect(r.balance).toBe(42000);
  });

  it("after setSessionCookie('abc'), getBalance() passes headers { Cookie: 'session_id=abc' }", async () => {
    setSessionCookie(SAMPLE_SESSION);
    await getBalance();
    expect(lastCall().headers).toEqual({ Cookie: EXPECTED_COOKIE_HEADER });
  });

  it('the session cookie value never appears in any function return value', async () => {
    setSessionCookie(SAMPLE_SESSION);
    mockHttp.mockResolvedValue({ status: 200, data: { balance: 1, lnurl: 'x', paid: true } });
    for (const result of [await getBalance(), await generateAuthUrl(), await checkPayment('h')]) {
      expect(JSON.stringify(result)).not.toContain(SAMPLE_SESSION);
    }
    expect(hasSession()).toBe(true); // only presence is exposed, never the value
  });

  it('deposit(999) throws and does NOT call httpRequest (below min)', async () => {
    await expect(deposit(999)).rejects.toThrow(/bounds/);
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it('deposit(100001) throws and does NOT call httpRequest (above max)', async () => {
    await expect(deposit(100001)).rejects.toThrow(/bounds/);
    expect(mockHttp).not.toHaveBeenCalled();
  });

  // ── Live auth/status contract (source api/auth/status.js, commit 7a06b30) ──
  // The first authenticated poll CONSUMES the one-shot k1 challenge server-side;
  // a re-poll returns `expired`. The session_id is in the JSON body (HttpOnly
  // Set-Cookie is unreadable from native) — these payloads are the real shapes.

  it('pollAuthStatus stores the session from the live authenticated payload (one poll, challenge consumed)', async () => {
    mockHttp.mockResolvedValueOnce({
      status: 200,
      data: { status: 'authenticated', session_id: 'live-uuid', balance: 0, nickname: null, avatar: null },
    });
    await expect(pollAuthStatus(SAMPLE_K1)).resolves.toBe('authenticated');
    expect(mockHttp).toHaveBeenCalledTimes(1); // never re-polls a consumed challenge
    expect(hasSession()).toBe(true);
  });

  it('pollAuthStatus accepts `authenticated` WITHOUT session_id (older API — platform cookie jar)', async () => {
    mockHttp.mockResolvedValueOnce({
      status: 200,
      data: { status: 'authenticated', balance: 0, nickname: null, avatar: null },
    });
    await expect(pollAuthStatus(SAMPLE_K1)).resolves.toBe('authenticated');
    expect(mockHttp).toHaveBeenCalledTimes(1);
  });

  it('pollAuthStatus fails closed on the live expired payload', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: { status: 'expired' } });
    await expect(pollAuthStatus(SAMPLE_K1)).resolves.toBe('expired');
  });

  it('authCallback throws fast on the LUD-04 HTTP-200 {status:ERROR} shape', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: { status: 'ERROR', reason: 'Signature invalide' } });
    await expect(authCallback(SAMPLE_K1, 'deadbeef', '02' + 'a'.repeat(64))).rejects.toThrow(/Signature invalide/);
  });

  it('authCallback resolves on {status:OK}', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: { status: 'OK' } });
    await expect(authCallback(SAMPLE_K1, 'deadbeef', '02' + 'a'.repeat(64))).resolves.toBeUndefined();
  });

  it('deposit(1000) and deposit(100000) are accepted (boundaries)', async () => {
    mockHttp.mockResolvedValue({ status: 200, data: { payment_hash: 'h', payment_request: 'lnbc1' } });
    await expect(deposit(1000)).resolves.toBeDefined();
    await expect(deposit(100000)).resolves.toBeDefined();
    expect(mockHttp).toHaveBeenCalledTimes(2);
  });
});
