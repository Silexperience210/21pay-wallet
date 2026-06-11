// RED stub — Wave-0 gap (Phase 5 / 05-01). Confirmed satoshi-casino21 HTTP
// contract via mocked httpRequest (CASINO-02). Filled GREEN in 05-04 Task 3
// (MANDATORY) against `@/sections/casino/casinoApi` (does not exist yet).
// Analog: src/wallet/backends/custodialLnbits.test.ts (mocked-net / httpRequest
// arg-assertion style). The cookie value is auth and must NEVER appear in a
// return value — only injected into request headers.
//
// Run: `npx jest src/sections/casino/casinoApi.test.ts`
//
// it.todo() (RED-by-design, suite stays green) until 05-04 Task 3 implements the
// module and mocks `@/core/net`, converting each todo to a spy-arg assertion.

// ---------------------------------------------------------------------------
// CONFIRMED satoshi-casino21 contract (RESEARCH O-1/O-2/O-4) — do NOT change.
// All calls go through httpRequest({ baseUrl: CASINO_ORIGIN, path, method, body,
// headers, idempotent }); the test asserts ARGUMENTS (no live network).
// ---------------------------------------------------------------------------
// GET  /api/auth/generate              -> { lnurl }                       idempotent: true
// GET  /api/auth/status?k1=<64hex>     -> { status }                      idempotent: true
// POST /api/deposit       { amount }   -> { payment_hash, payment_request} idempotent: FALSE; amount int 1000..100000
// GET  /api/check-payment/<hash>       -> { paid }                        idempotent: true
// POST /api/withdraw      { invoice }  -> {}                              idempotent: FALSE
// GET  /api/balance                    -> { balance }                     idempotent: true
// auth = Cookie: session_id=<value> header injected into httpRequest headers
export const EXPECTED_DEPOSIT_MIN_SAT = 1000;
export const EXPECTED_DEPOSIT_MAX_SAT = 100000;
export const SAMPLE_SESSION = 'abc';
export const EXPECTED_COOKIE_HEADER = `session_id=${SAMPLE_SESSION}`;
export const SAMPLE_DEPOSIT_AMOUNT = 50000;
export const SAMPLE_WITHDRAW_INVOICE = 'lnbc500u1pjwithdrawxxx';
export const SAMPLE_PAYMENT_HASH = 'a'.repeat(64);
export const SAMPLE_K1 = 'f'.repeat(64);

describe('casinoApi — confirmed contract via mocked httpRequest (CASINO-02) [RED stub, filled 05-04 Task 3]', () => {
  // Routes + method + body (baseUrl is CASINO_ORIGIN for every call).
  it.todo('generateAuthUrl() calls GET /api/auth/generate');
  it.todo('authStatus(k1) calls GET /api/auth/status?k1=<64hex>');
  it.todo('deposit(50000) calls POST /api/deposit with body { amount: 50000 }');
  it.todo('checkPayment(hash) calls GET /api/check-payment/<hash>');
  it.todo('withdraw(invoice) calls POST /api/withdraw with body { invoice }');
  it.todo('getBalance() calls GET /api/balance');

  // Per-method idempotency: reads true (auto-retry), payments FALSE (never blind-retry).
  it.todo('deposit(50000) passes idempotent: false');
  it.todo('withdraw(invoice) passes idempotent: false');
  it.todo('getBalance() passes idempotent: true');
  it.todo('checkPayment(hash) passes idempotent: true');
  it.todo('authStatus(k1) passes idempotent: true');
  it.todo('generateAuthUrl() passes idempotent: true');

  // Cookie auth: injected into headers; NEVER part of a return value.
  it.todo("after setSessionCookie('abc'), getBalance() passes headers { Cookie: 'session_id=abc' }");
  it.todo('the session cookie value never appears in any function return value');

  // Deposit bounds: rejected BEFORE httpRequest is called (spy not called).
  it.todo('deposit(999) throws/rejects and does NOT call httpRequest (below min)');
  it.todo('deposit(100001) throws/rejects and does NOT call httpRequest (above max)');
  it.todo('deposit(1000) is accepted (min boundary)');
  it.todo('deposit(100000) is accepted (max boundary)');
});
