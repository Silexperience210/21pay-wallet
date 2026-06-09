// Req SEC-07 (logic) — VALIDATION.md "selftest" row.
// The same cryptoSelfTest() runs on-device on the release APK for the SEC-07 proof.
import { cryptoSelfTest } from './selftest';

describe('cryptoSelfTest (SEC-07 logic)', () => {
  it('passes: native RNG + NIP-06 reference keygen + sign/verify round-trip', () => {
    const r = cryptoSelfTest();
    expect(r.ok).toBe(true);
    expect(r.level).toBe('native');
    expect(r.details.length).toBeGreaterThan(0);
  });
});
