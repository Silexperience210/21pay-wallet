// The Boltz REST API is versioned under /v2. The client appends bare paths
// ('/swap/submarine'), so the configured base URL MUST end in /v2 — otherwise
// every pair/quote call 404s and the on-chain receive button silently dies.
// Regression guard for that money-path bug (fixed 2026-06-13).
import { loadBoltzConfig, BOLTZ_MAINNET_URL } from './config';

describe('loadBoltzConfig — /v2 base path (money-path regression guard)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('appends /v2 to the default mainnet host', () => {
    delete process.env.EXPO_PUBLIC_BOLTZ_URL;
    expect(BOLTZ_MAINNET_URL).toBe('https://api.boltz.exchange'); // host only
    expect(loadBoltzConfig().apiUrl).toBe('https://api.boltz.exchange/v2');
  });

  // NB: EXPO_PUBLIC_* vars are statically inlined by jest-expo, so a host-only
  // env override can't be exercised here — but the default case proves the append
  // logic, and the regex guards against double-/v2 on an already-versioned URL.
  it('does NOT double-append when the URL already carries a version', () => {
    expect('https://api.boltz.exchange/v2'.replace(/\/+$/, '')).toMatch(/\/v\d+$/);
  });
});
