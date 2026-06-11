// WebView->native bridge message parser, fail-closed (CASINO-02/04). GREEN in 05-04.
// The WebView runs untrusted third-party JS -> every message is hostile input.
//
// Run: `npx jest src/sections/casino/bridge.test.ts`
import { parseBridgeMessage, BRIDGE_JS } from './bridge';

// ---------------------------------------------------------------------------
// LITERAL CONTRACT (from the 05-01 RED stub — unchanged).
// ---------------------------------------------------------------------------
export const VALID_DEPOSIT_REQUEST = JSON.stringify({
  type: 'deposit_request',
  bolt11: 'lnbc10n1pjxxxxx',
  amountSat: 1000,
});
export const VALID_BALANCE_UPDATE = JSON.stringify({ type: 'balance_update', casinoBalanceSat: 42000 });
export const MALFORMED_JSON = '{ this is not json ';
export const UNKNOWN_TYPE = JSON.stringify({ type: 'withdraw_everything', amountSat: 999999 });
export const MISSING_FIELD_FOR_KNOWN_TYPE = JSON.stringify({ type: 'balance_update' }); // no casinoBalanceSat

describe('casino bridge — message parser (fail-closed)', () => {
  it("parseBridgeMessage(VALID_DEPOSIT_REQUEST) returns a typed { type: 'deposit_request', ... }", () => {
    expect(parseBridgeMessage(VALID_DEPOSIT_REQUEST)).toEqual({
      type: 'deposit_request',
      bolt11: 'lnbc10n1pjxxxxx',
      lnurl: undefined,
      amountSat: 1000,
    });
  });

  it("parseBridgeMessage(VALID_BALANCE_UPDATE) returns a typed { type: 'balance_update', ... }", () => {
    expect(parseBridgeMessage(VALID_BALANCE_UPDATE)).toEqual({
      type: 'balance_update',
      casinoBalanceSat: 42000,
    });
  });

  it('parseBridgeMessage(MALFORMED_JSON) returns null (never throws)', () => {
    expect(parseBridgeMessage(MALFORMED_JSON)).toBeNull();
  });

  it('parseBridgeMessage(UNKNOWN_TYPE) returns null (unknown type rejected)', () => {
    expect(parseBridgeMessage(UNKNOWN_TYPE)).toBeNull();
  });

  it('parseBridgeMessage(MISSING_FIELD_FOR_KNOWN_TYPE) returns null (missing required field)', () => {
    expect(parseBridgeMessage(MISSING_FIELD_FOR_KNOWN_TYPE)).toBeNull();
  });

  it('parseBridgeMessage of a non-string / non-object payload returns null, never throws', () => {
    expect(parseBridgeMessage(42 as unknown as string)).toBeNull();
    expect(parseBridgeMessage(undefined as unknown as string)).toBeNull();
    expect(parseBridgeMessage(JSON.stringify('a plain string'))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify([1, 2, 3]))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify(null))).toBeNull();
  });

  it('deposit_request with an out-of-bound amount is rejected (T-05-09)', () => {
    expect(parseBridgeMessage(JSON.stringify({ type: 'deposit_request', amountSat: 999 }))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ type: 'deposit_request', amountSat: 100001 }))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ type: 'deposit_request', amountSat: 10.5 }))).toBeNull();
  });

  it('BRIDGE_JS is exported and ends with a truthy expression (WebView requirement)', () => {
    expect(typeof BRIDGE_JS).toBe('string');
    expect(BRIDGE_JS.trim().endsWith('true;')).toBe(true);
  });
});
