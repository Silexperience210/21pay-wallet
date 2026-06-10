// NWC (NIP-47 / Nostr Wallet Connect) URI parsing + validation. PURE — no IO,
// fully unit-testable. Mirrors lnbitsConfig.ts: the `secret` is a per-connection
// runtime secret — NEVER hard-coded, NEVER committed, NEVER logged.
//
// Security (Phase 4 threat register):
//  - T-04-01 Tampering: reject malformed secret / wrong protocol / missing fields
//    here, fail-closed BEFORE any secret is stored.
//  - T-04-02 Information Disclosure: this module returns a plain struct, does not
//    log the secret, and does NOT import from core/keys/derivation — the NWC
//    secret is a FRESH per-connection key, structurally independent of the Nostr
//    identity key at m/44'/1237' (IDENT-03 / CLAUDE.md #2 blast-radius separation).
//
// URI form (NIP-47):
//   nostr+walletconnect://<wallet-pubkey-hex>?relay=wss://...&secret=<64-hex>&lud16=name@domain

export interface NwcUri {
  walletPubkey: string;
  relay: string;
  secret: string;
  lud16?: string;
}

export function parseNwcUri(raw: string): NwcUri {
  const u = new URL(raw.trim()); // WHATWG URL via react-native-url-polyfill
  if (u.protocol !== 'nostr+walletconnect:') throw new Error('not an NWC URI');
  const walletPubkey = u.hostname || u.pathname.replace(/^\/+/, '');
  const relay = u.searchParams.get('relay');
  const secret = u.searchParams.get('secret');
  if (!walletPubkey || !relay || !secret) {
    throw new Error('NWC URI missing relay/secret/pubkey');
  }
  if (!/^[0-9a-f]{64}$/i.test(secret)) throw new Error('NWC secret malformed');
  return { walletPubkey, relay, secret, lud16: u.searchParams.get('lud16') ?? undefined };
}
