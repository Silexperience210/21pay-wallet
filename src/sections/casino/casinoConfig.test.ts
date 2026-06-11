// Origin allow/deny classification + deposit bounds (CASINO-01/02). GREEN in 05-04.
// Analog: src/core/featureGate/featureGate.test.ts (strict-validation style).
//
// Run: `npx jest src/sections/casino/casinoConfig.test.ts`
import { isCasinoOrigin, DEPOSIT_MIN_SAT, DEPOSIT_MAX_SAT } from './casinoConfig';

// ---------------------------------------------------------------------------
// LITERAL CONTRACT (from the 05-01 RED stub — unchanged).
// ---------------------------------------------------------------------------
export const CASINO_HOST = 'satoshi-casino21.vercel.app';
export const ALLOWED_URL = `https://${CASINO_HOST}/foo`;
export const OFF_DOMAIN_URL = 'https://evil.example.com/foo';
export const NON_HTTPS_URL = `http://${CASINO_HOST}/foo`; // non-https same host -> deny
export const GARBAGE_URL = 'not a url at all';
export const EXPECTED_DEPOSIT_MIN_SAT = 1000;
export const EXPECTED_DEPOSIT_MAX_SAT = 100000;

describe('casinoConfig — origin classification + deposit bounds', () => {
  it(`isCasinoOrigin('${ALLOWED_URL}') === true`, () => {
    expect(isCasinoOrigin(ALLOWED_URL)).toBe(true);
  });
  it(`isCasinoOrigin('${OFF_DOMAIN_URL}') === false (off-domain host)`, () => {
    expect(isCasinoOrigin(OFF_DOMAIN_URL)).toBe(false);
  });
  it(`isCasinoOrigin('${NON_HTTPS_URL}') === false (non-https rejected)`, () => {
    expect(isCasinoOrigin(NON_HTTPS_URL)).toBe(false);
  });
  it(`isCasinoOrigin('${GARBAGE_URL}') === false (non-URL garbage, never throws)`, () => {
    expect(isCasinoOrigin(GARBAGE_URL)).toBe(false);
  });
  it(`DEPOSIT_MIN_SAT === ${EXPECTED_DEPOSIT_MIN_SAT}`, () => {
    expect(DEPOSIT_MIN_SAT).toBe(EXPECTED_DEPOSIT_MIN_SAT);
  });
  it(`DEPOSIT_MAX_SAT === ${EXPECTED_DEPOSIT_MAX_SAT}`, () => {
    expect(DEPOSIT_MAX_SAT).toBe(EXPECTED_DEPOSIT_MAX_SAT);
  });
});
