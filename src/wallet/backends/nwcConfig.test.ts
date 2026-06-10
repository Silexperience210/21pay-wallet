// Req ONBD-02 — parseNwcUri pure parser/validator. No IO (uses the polyfilled URL).
// Threat T-04-01: malformed/missing/wrong-protocol inputs must fail closed.
import { parseNwcUri } from './nwcConfig';

// A real-shape per-connection secret (64 lowercase hex) and a 64-hex wallet pubkey.
const SECRET = 'a'.repeat(64);
const PUBKEY = 'b'.repeat(64);
const RELAY = 'wss://relay.example.com';

const uri = (params: Record<string, string>) => {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `nostr+walletconnect://${PUBKEY}?${qs}`;
};

describe('parseNwcUri (ONBD-02)', () => {
  it('parses a valid URI into { walletPubkey, relay, secret }', () => {
    const r = parseNwcUri(uri({ relay: RELAY, secret: SECRET }));
    expect(r.walletPubkey).toBe(PUBKEY);
    expect(r.relay).toBe(RELAY);
    expect(r.secret).toBe(SECRET);
    expect(r.lud16).toBeUndefined();
  });

  it('extracts optional lud16 when present', () => {
    const r = parseNwcUri(uri({ relay: RELAY, secret: SECRET, lud16: 'sat@21pay.org' }));
    expect(r.lud16).toBe('sat@21pay.org');
  });

  it('lud16 is undefined when absent', () => {
    const r = parseNwcUri(uri({ relay: RELAY, secret: SECRET }));
    expect(r.lud16).toBeUndefined();
  });

  it('trims surrounding whitespace before parsing', () => {
    const r = parseNwcUri(`  ${uri({ relay: RELAY, secret: SECRET })}  `);
    expect(r.secret).toBe(SECRET);
  });

  it('rejects a wrong protocol (not nostr+walletconnect:)', () => {
    expect(() => parseNwcUri(`https://${PUBKEY}?relay=${RELAY}&secret=${SECRET}`)).toThrow(
      /not an NWC URI/,
    );
  });

  it('rejects a missing relay', () => {
    expect(() => parseNwcUri(`nostr+walletconnect://${PUBKEY}?secret=${SECRET}`)).toThrow(
      /missing relay\/secret\/pubkey/,
    );
  });

  it('rejects a missing secret', () => {
    expect(() =>
      parseNwcUri(`nostr+walletconnect://${PUBKEY}?relay=${encodeURIComponent(RELAY)}`),
    ).toThrow(/missing relay\/secret\/pubkey/);
  });

  it('rejects a missing pubkey (no host)', () => {
    expect(() =>
      parseNwcUri(`nostr+walletconnect://?relay=${encodeURIComponent(RELAY)}&secret=${SECRET}`),
    ).toThrow(/missing relay\/secret\/pubkey/);
  });

  it('rejects a malformed secret (not 64 hex)', () => {
    expect(() => parseNwcUri(uri({ relay: RELAY, secret: 'deadbeef' }))).toThrow(
      /secret malformed/,
    );
  });

  it('rejects a 64-char secret with non-hex characters', () => {
    expect(() => parseNwcUri(uri({ relay: RELAY, secret: 'z'.repeat(64) }))).toThrow(
      /secret malformed/,
    );
  });

  it('accepts an uppercase-hex secret (case-insensitive 64-hex)', () => {
    const upper = 'A'.repeat(64);
    expect(parseNwcUri(uri({ relay: RELAY, secret: upper })).secret).toBe(upper);
  });
});
