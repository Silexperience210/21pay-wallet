import { fetchFeatureGate, isFeatureEnabled, __resetGateForTests } from './featureGate';

const GATE_URL = 'https://gate.example.test/v1/flags';

function mockFetchResolve(body: unknown, ok = true, status = 200) {
  (global as any).fetch = jest.fn(async () => ({
    ok,
    status,
    json: async () => body,
  }));
}

function mockFetchReject(err: unknown) {
  (global as any).fetch = jest.fn(async () => {
    throw err;
  });
}

describe('featureGate (fail-closed, spoof-resistant)', () => {
  beforeEach(() => {
    __resetGateForTests();
    process.env.EXPO_PUBLIC_FEATURE_GATE_URL = GATE_URL;
  });

  // Test 1: happy path — server enables flags
  it('enables a flag when the server returns it true', async () => {
    mockFetchResolve({ casino: true, custodial: true });
    await fetchFeatureGate();
    expect(isFeatureEnabled('casino')).toBe(true);
    expect(isFeatureEnabled('custodial')).toBe(true);
  });

  // Test 2: network failure -> fail closed, no throw
  it('fails closed when the endpoint is unreachable', async () => {
    mockFetchReject(new Error('network down'));
    const gate = await fetchFeatureGate();
    expect(gate).toEqual({ casino: false, custodial: false, mineurs: false });
    expect(isFeatureEnabled('casino')).toBe(false);
  });

  // Test 3: non-200 / malformed body -> all false (spoof/garbage cannot enable)
  it('falls back to all-false on non-200 status', async () => {
    mockFetchResolve({ casino: true }, false, 503);
    await fetchFeatureGate();
    expect(isFeatureEnabled('casino')).toBe(false);
  });

  it('falls back to all-false on a non-object body', async () => {
    mockFetchResolve('definitely-not-json-object');
    await fetchFeatureGate();
    expect(isFeatureEnabled('casino')).toBe(false);
    expect(isFeatureEnabled('custodial')).toBe(false);
  });

  // Test 4: missing known flag -> false
  it('resolves a missing known flag to false', async () => {
    mockFetchResolve({ casino: true }); // custodial omitted
    await fetchFeatureGate();
    expect(isFeatureEnabled('casino')).toBe(true);
    expect(isFeatureEnabled('custodial')).toBe(false);
  });

  // Test 5: default OFF before any fetch
  it('returns false for every feature before any fetch', () => {
    expect(isFeatureEnabled('casino')).toBe(false);
    expect(isFeatureEnabled('custodial')).toBe(false);
  });

  // Test 6: non-boolean truthy values coerce to false (type-confusion spoof guard)
  it('coerces non-boolean truthy values to false (strict boolean)', async () => {
    mockFetchResolve({ casino: 'true', custodial: 1 });
    await fetchFeatureGate();
    expect(isFeatureEnabled('casino')).toBe(false);
    expect(isFeatureEnabled('custodial')).toBe(false);
  });

  // Extra: unset env var -> fail closed
  it('fails closed when the gate URL env var is unset', async () => {
    delete process.env.EXPO_PUBLIC_FEATURE_GATE_URL;
    const gate = await fetchFeatureGate();
    expect(gate).toEqual({ casino: false, custodial: false, mineurs: false });
  });

  // Phase 6 (DIST-02): the Mineurs section entry uses the same per-flag gating.
  it('mineurs flag is independent and strictly validated', async () => {
    mockFetchResolve({ casino: true, custodial: true, mineurs: true });
    await fetchFeatureGate();
    expect(isFeatureEnabled('mineurs')).toBe(true);
    mockFetchResolve({ casino: true, custodial: true, mineurs: 'true' });
    await fetchFeatureGate();
    expect(isFeatureEnabled('mineurs')).toBe(false); // strict boolean
  });

  // Phase 5 (DIST-02): the Casino section entry is driven by this exact gating.
  it('casino flag off → the Casino section entry is hidden (fail-closed default)', () => {
    expect(isFeatureEnabled('casino')).toBe(false); // no fetch yet → hidden
  });

  it('casino flag on (validated gate) → the Casino section entry is shown', async () => {
    mockFetchResolve({ casino: true, custodial: false });
    await fetchFeatureGate();
    expect(isFeatureEnabled('casino')).toBe(true);
    expect(isFeatureEnabled('custodial')).toBe(false); // gating is per-flag
  });
});
