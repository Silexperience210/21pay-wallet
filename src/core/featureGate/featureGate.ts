import { DEFAULT_GATE, FeatureGate, FeatureName } from './types';

// Server-driven feature gate. Casino + custodial mode are wrapped so a future
// Play-safe stripped build can flip them OFF server-side without a rebuild
// (CLAUDE.md constraint 3). The gate FAILS CLOSED and validates strictly so a
// spoofed/tampered response cannot silently re-enable a stripped build (T-00-05).

const GATE_TIMEOUT_MS = 4000;

// Module-scoped cache of the last validated gate. Defaults to all-false until a
// successful fetch — so isFeatureEnabled is fail-closed before any network call.
let cachedGate: FeatureGate = { ...DEFAULT_GATE };

const KNOWN_FLAGS: FeatureName[] = ['casino', 'custodial', 'mineurs', 'markets'];

/**
 * Strict validation: read only known keys, and accept a flag ONLY when it is
 * the boolean `true`. Strings/numbers/objects all coerce to false. This is the
 * spoof guard — a tampered response cannot smuggle a truthy non-boolean.
 */
function validateGate(body: unknown): FeatureGate {
  const result: FeatureGate = { ...DEFAULT_GATE };
  if (body === null || typeof body !== 'object') {
    return result;
  }
  const obj = body as Record<string, unknown>;
  for (const flag of KNOWN_FLAGS) {
    result[flag] = obj[flag] === true; // strict boolean equality
  }
  return result;
}

/**
 * Fetch the gate from the server endpoint. NEVER throws — always resolves to a
 * valid FeatureGate. On non-200, network error, timeout, non-JSON, or non-object
 * body, resolves to the ALL-FALSE default (fail closed).
 */
export async function fetchFeatureGate(): Promise<FeatureGate> {
  const url = process.env.EXPO_PUBLIC_FEATURE_GATE_URL;
  if (!url) {
    if (__DEV__) {
      console.warn('[featureGate] EXPO_PUBLIC_FEATURE_GATE_URL unset — failing closed.');
    }
    cachedGate = { ...DEFAULT_GATE };
    return cachedGate;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GATE_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`gate responded ${res.status}`);
    }
    const body: unknown = await res.json();
    cachedGate = validateGate(body);
    return cachedGate;
  } catch (err) {
    if (__DEV__) {
      console.warn('[featureGate] fetch failed — failing closed.', err);
    }
    cachedGate = { ...DEFAULT_GATE };
    return cachedGate;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Read the last validated gate. Returns false if no successful fetch has
 * occurred (fail-closed default).
 */
export function isFeatureEnabled(name: FeatureName): boolean {
  return cachedGate[name] === true;
}

/** Test-only helper to reset the module cache between cases. */
export function __resetGateForTests(): void {
  cachedGate = { ...DEFAULT_GATE };
}
