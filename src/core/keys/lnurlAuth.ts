// LNURL-auth (LUD-04) signer over a LUD-05 per-domain linking key — the casino-login
// primitive (D-05). The linking key derives on its OWN hardened family m/138' so a
// leaked casino key can never impersonate the Nostr identity (m/44'/1237') nor move
// spending funds (m/44'/0') — blast-radius separation (CLAUDE.md constraint 2).
//
// LUD-04 requires ECDSA over secp256k1 with a DER-encoded signature — NOT Nostr's
// Schnorr signEvent (wrong primitive). Raw key material is born and dies inside these
// functions: derive → sign → zeroize; only { sig, key } crosses out (SEC-04).
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
// NB: .js suffixes are REQUIRED by the packages' ESM exports maps (same pitfall as
// '@scure/bip39/wordlists/english.js' — see Phase 1 notes).
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';

const LNURL_AUTH_FAMILY = "m/138'"; // LUD-05 — distinct from identity/spending families

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) throw new Error('invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Big-endian uint32 read that respects the view's byteOffset (typed-array safety). */
function dv32(b: Uint8Array, offset: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(offset, false);
}

const HARDENED = 0x80000000;

/** LUD-05 path computation from a hashing key (pure — spec-vector testable):
 *  components = 4 × BE-uint32 of HMAC-SHA256(hashingKey, domain). */
export function lnurlAuthPathFromHashingKey(
  hashingKey: Uint8Array,
  domain: string,
): { path: string; parts: [number, number, number, number] } {
  const h = hmac(sha256, hashingKey, new TextEncoder().encode(domain));
  const parts: [number, number, number, number] = [dv32(h, 0), dv32(h, 4), dv32(h, 8), dv32(h, 12)];
  return { path: `${LNURL_AUTH_FAMILY}/${parts.join('/')}`, parts };
}

/** LUD-05: derive the per-domain linking-key path + node from the master mnemonic.
 *  hashingKey = m/138'/0 privkey; path = lnurlAuthPathFromHashingKey(hashingKey, domain).
 *  The components are RAW uint32 indices — values ≥ 2^31 are hardened by BIP32
 *  semantics, so derivation goes through deriveChild(rawIndex) (the string path
 *  parser rejects them). The `path` string is the LUD-05 display form. */
function deriveNode(mnemonic: string, domain: string): { path: string; node: HDKey } {
  const seed = mnemonicToSeedSync(mnemonic);
  const master = HDKey.fromMasterSeed(seed);
  const hashingNode = master.derive(`${LNURL_AUTH_FAMILY}/0`);
  if (!hashingNode.privateKey) throw new Error('could not derive LNURL-auth hashing key');
  const { path, parts } = lnurlAuthPathFromHashingKey(hashingNode.privateKey, domain);
  hashingNode.privateKey.fill(0); // intermediate key zeroized too
  let node = master.deriveChild(138 + HARDENED); // m/138'
  for (const idx of parts) node = node.deriveChild(idx); // raw uint32 (≥2^31 ⇒ hardened)
  if (!node.privateKey || !node.publicKey) throw new Error('could not derive LNURL-auth linking key');
  return { path, node };
}

/** Per-domain linking-key derivation (LUD-05). PUBLIC data only — the path (for
 *  vector tests) and the compressed pubkey; never the private key. */
export function deriveLnurlAuthKey(mnemonic: string, domain: string): { path: string; key: string } {
  const { path, node } = deriveNode(mnemonic, domain);
  try {
    return { path, key: bytesToHex(node.publicKey!) };
  } finally {
    node.privateKey!.fill(0);
  }
}

/** LUD-04: sign the LNURL-auth k1 challenge with the per-domain linking key.
 *  Returns { sig: DER-hex ECDSA signature, key: compressed pubkey hex } — exactly the
 *  query params the casino callback expects. The raw privkey is zeroized in finally. */
export function signLnurlAuth(
  mnemonic: string,
  k1Hex: string,
  domain: string,
): { sig: string; key: string } {
  if (!/^[0-9a-f]{64}$/i.test(k1Hex)) throw new Error('k1 must be 32 bytes of hex');
  const { node } = deriveNode(mnemonic, domain);
  const sk = node.privateKey!;
  try {
    // noble/curves 2.x: sign() returns the compact 64-byte sig; DER comes via Signature.
    const compact = secp256k1.sign(hexToBytes(k1Hex), sk, { prehash: false });
    const sig = secp256k1.Signature.fromBytes(compact).toHex('der');
    return { sig: sig.toLowerCase(), key: bytesToHex(node.publicKey!) };
  } finally {
    sk.fill(0); // SEC-04: the raw key never leaves Core
  }
}
