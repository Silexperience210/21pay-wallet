// Schnorr (BIP-340) event verification — ported from hunch-web (mirrors the Rust
// `hunch_nostr::verify_event`). Relays are UNTRUSTED: anything read from a relay
// must pass this before being trusted. Recompute the NIP-01 id, check it equals
// `ev.id`, then verify the BIP-340 signature under `ev.pubkey` (x-only).
import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { canonicalSerialization, type NostrEvent } from './hunch';

/** Recomputes the 32-byte NIP-01 event id (hex). */
export function eventId(ev: Pick<NostrEvent, 'pubkey' | 'created_at' | 'kind' | 'tags' | 'content'>): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonicalSerialization(ev))));
}

/** True iff the id matches the fields AND the Schnorr sig verifies. Never throws. */
export function verifyEvent(ev: NostrEvent): boolean {
  try {
    const id = sha256(new TextEncoder().encode(canonicalSerialization(ev)));
    if (bytesToHex(id) !== ev.id) return false;
    return schnorr.verify(hexToBytes(ev.sig), id, hexToBytes(ev.pubkey));
  } catch {
    return false;
  }
}
