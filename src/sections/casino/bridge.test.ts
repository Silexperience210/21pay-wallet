// RED stub — Wave-0 gap (Phase 5 / 05-01). WebView->native bridge message
// parser/validator, fail-closed (CASINO-02/04). Filled GREEN in 05-04 against
// `@/sections/casino/bridge` (does not exist yet).
// Analog: src/core/featureGate/featureGate.test.ts (fail-closed, strict-validation
// style) + src/wallet/backends/nwcConfig.ts (strict parse, never throw).
//
// Run: `npx jest src/sections/casino/bridge.test.ts`
//
// it.todo() (RED-by-design, suite stays green) until 05-04 implements the module
// and converts each to a real assertion — same convention as spark.test.ts.

// ---------------------------------------------------------------------------
// LITERAL CONTRACT the 05-04 implementation must satisfy (do NOT change these).
// ---------------------------------------------------------------------------
// parseBridgeMessage(raw: string): BridgeMsg | null
// Known types (RESEARCH Code Example):
//   { type: 'deposit_request'; bolt11?: string; lnurl?: string; amountSat?: number }
//   { type: 'balance_update'; casinoBalanceSat: number }
//   { type: 'provably_fair'; serverSeedHash: string; clientSeed: string; nonce: number }
// The WebView runs untrusted third-party JS -> every message is hostile input.

export const VALID_DEPOSIT_REQUEST = JSON.stringify({
  type: 'deposit_request',
  bolt11: 'lnbc10n1pjxxxxx',
  amountSat: 1000,
});
export const VALID_BALANCE_UPDATE = JSON.stringify({ type: 'balance_update', casinoBalanceSat: 42000 });
export const MALFORMED_JSON = '{ this is not json ';
export const UNKNOWN_TYPE = JSON.stringify({ type: 'withdraw_everything', amountSat: 999999 });
export const MISSING_FIELD_FOR_KNOWN_TYPE = JSON.stringify({ type: 'balance_update' }); // no casinoBalanceSat

describe('casino bridge — message parser (fail-closed) [RED stub, filled 05-04]', () => {
  it.todo("parseBridgeMessage(VALID_DEPOSIT_REQUEST) returns a typed { type: 'deposit_request', ... }");
  it.todo("parseBridgeMessage(VALID_BALANCE_UPDATE) returns a typed { type: 'balance_update', ... }");

  // Fail-closed: never throw, return null.
  it.todo('parseBridgeMessage(MALFORMED_JSON) returns null (never throws)');
  it.todo('parseBridgeMessage(UNKNOWN_TYPE) returns null (unknown type rejected)');
  it.todo('parseBridgeMessage(MISSING_FIELD_FOR_KNOWN_TYPE) returns null (missing required field)');
  it.todo('parseBridgeMessage of a non-string / non-object payload returns null, never throws');
});
