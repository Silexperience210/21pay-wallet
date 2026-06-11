// WebView→native bridge message validator. The WebView runs UNTRUSTED third-party
// JS (RESEARCH Pitfall 3 / T-05-09): every postMessage is hostile input until it
// passes this fail-closed parser — unknown type, malformed JSON, wrong field types,
// or out-of-bound amounts all return null. This module only PARSES and NARROWS;
// it never pays, never throws, never auto-acts (mirror of featureGate's validation).
import { DEPOSIT_MIN_SAT, DEPOSIT_MAX_SAT } from './casinoConfig';

export type BridgeMsg =
  | { type: 'deposit_request'; bolt11?: string; lnurl?: string; amountSat?: number }
  | { type: 'balance_update'; casinoBalanceSat: number }
  | { type: 'provably_fair'; serverSeedHash: string; clientSeed: string; nonce: number };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Fail-closed: returns a narrowed BridgeMsg or null. NEVER throws. */
export function parseBridgeMessage(raw: unknown): BridgeMsg | null {
  if (typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;

  switch (o.type) {
    case 'deposit_request': {
      if (o.bolt11 !== undefined && typeof o.bolt11 !== 'string') return null;
      if (o.lnurl !== undefined && typeof o.lnurl !== 'string') return null;
      if (o.amountSat !== undefined) {
        if (!isFiniteNumber(o.amountSat) || !Number.isInteger(o.amountSat)) return null;
        if (o.amountSat < DEPOSIT_MIN_SAT || o.amountSat > DEPOSIT_MAX_SAT) return null;
      }
      return { type: 'deposit_request', bolt11: o.bolt11 as string | undefined, lnurl: o.lnurl as string | undefined, amountSat: o.amountSat as number | undefined };
    }
    case 'balance_update': {
      if (!isFiniteNumber(o.casinoBalanceSat)) return null;
      return { type: 'balance_update', casinoBalanceSat: o.casinoBalanceSat };
    }
    case 'provably_fair': {
      if (typeof o.serverSeedHash !== 'string' || typeof o.clientSeed !== 'string' || !isFiniteNumber(o.nonce)) {
        return null;
      }
      return { type: 'provably_fair', serverSeedHash: o.serverSeedHash, clientSeed: o.clientSeed, nonce: o.nonce };
    }
    default:
      return null; // unknown type — rejected (fail-closed)
  }
}

// Injected BEFORE the page content loads (injectedJavaScriptBeforeContentLoaded).
// Installs a tiny helper the page can call to surface balance/provably-fair data to
// native via window.ReactNativeWebView.postMessage. The EXACT casino DOM hook is
// confirmed at the device checkpoint (05-06) — per RESEARCH O-2, deposit/withdraw
// are native API calls, so the bridge's primary live role is session/PF surfacing,
// NOT payment interception. Must end with a truthy expression (WebView requirement).
export const BRIDGE_JS = `
(function () {
  if (window.__pay21Bridge) return;
  window.__pay21Bridge = {
    send: function (msg) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      } catch (e) { /* never break the page */ }
    }
  };
})();
true;
`;
