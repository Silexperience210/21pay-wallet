// RED stub — Wave-0 gap (Phase 5 / 05-01). Origin allow/deny classification +
// deposit bounds (CASINO-01/02). Filled GREEN in 05-04 against
// `@/sections/casino/casinoConfig` (does not exist yet).
// Analog: src/core/featureGate/featureGate.test.ts (strict-validation style).
//
// Run: `npx jest src/sections/casino/casinoConfig.test.ts`
//
// it.todo() (RED-by-design, suite stays green) until 05-04 implements the module.

// ---------------------------------------------------------------------------
// LITERAL CONTRACT the 05-04 implementation must satisfy (do NOT change these).
// ---------------------------------------------------------------------------
// isCasinoOrigin(url): true ONLY for https + the casino host; fail-closed otherwise.
// DEPOSIT_MIN_SAT === 1000, DEPOSIT_MAX_SAT === 100000 (confirmed casino contract).
export const CASINO_HOST = 'satoshi-casino21.vercel.app';
export const ALLOWED_URL = `https://${CASINO_HOST}/foo`;
export const OFF_DOMAIN_URL = 'https://evil.example.com/foo';
export const NON_HTTPS_URL = `http://${CASINO_HOST}/foo`; // non-https same host -> deny
export const GARBAGE_URL = 'not a url at all';
export const EXPECTED_DEPOSIT_MIN_SAT = 1000;
export const EXPECTED_DEPOSIT_MAX_SAT = 100000;

describe('casinoConfig — origin classification + deposit bounds [RED stub, filled 05-04]', () => {
  it.todo(`isCasinoOrigin('${ALLOWED_URL}') === true`);
  it.todo(`isCasinoOrigin('${OFF_DOMAIN_URL}') === false (off-domain host)`);
  it.todo(`isCasinoOrigin('${NON_HTTPS_URL}') === false (non-https rejected)`);
  it.todo(`isCasinoOrigin('${GARBAGE_URL}') === false (non-URL garbage, never throws)`);
  it.todo(`DEPOSIT_MIN_SAT === ${EXPECTED_DEPOSIT_MIN_SAT}`);
  it.todo(`DEPOSIT_MAX_SAT === ${EXPECTED_DEPOSIT_MAX_SAT}`);
});
