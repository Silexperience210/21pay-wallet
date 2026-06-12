// Oracle mode (Markets): announce a committed nonce, then attest the outcome by
// signing BIP-340 WITH THAT FIXED NONCE — the one signature in the app where the
// library must NOT pick the nonce (the DLC lock key L = B + S_X was derived from
// the announced R; a different nonce wouldn't unlock anything).
//
// ☢️ EQUIVOCATION = KEY LEAK: two outcomes signed under one nonce reveal the
// private key (s1−s2 = (e1−e2)·d). The vault stores the attested outcome and this
// module refuses any different second outcome — re-attesting the SAME outcome is
// idempotent (same k, same message ⇒ same signature). Mirrors the Rust
// hunch-oracle nonce_store guard.
import { secp256k1, schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { loadNostrPrivkeyBytes } from './derivation';
import {
  storeOracleNonce,
  loadOracleNonce,
  hasOracleNonce,
  getAttestedOutcome,
  setAttestedOutcome,
} from './vault';

const Point = secp256k1.Point;
const N = Point.Fn.ORDER;

const toBig = (b: Uint8Array): bigint => BigInt('0x' + bytesToHex(b));
const to32 = (n: bigint): Uint8Array => hexToBytes(n.toString(16).padStart(64, '0'));

function taggedHash(tag: string, msg: Uint8Array): Uint8Array {
  const t = sha256(new TextEncoder().encode(tag));
  const buf = new Uint8Array(t.length * 2 + msg.length);
  buf.set(t, 0);
  buf.set(t, t.length);
  buf.set(msg, t.length * 2);
  return sha256(buf);
}

/** The canonical message the oracle signs — MUST match hunch-protocol/dlc.ts. */
export function attestationDigest(market: string, outcome: string): Uint8Array {
  return sha256(new TextEncoder().encode(`hunch/oracle/v1\n${market}\n${outcome}`));
}

/** Stable storage key for a market id (ids contain ':' — not SecureStore-safe). */
export function marketHash(marketId: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(marketId))).slice(0, 32);
}

/** BIP-340 signature with a CALLER-FIXED nonce k. Handles the even-y negations
 *  for both R and P per the spec. Returns 64-byte sig (R_x || s). */
export function signWithCommittedNonce(dBytes: Uint8Array, kBytes: Uint8Array, msg32: Uint8Array): Uint8Array {
  let d = toBig(dBytes) % N;
  let k = toBig(kBytes) % N;
  if (d === 0n || k === 0n) throw new Error('oracle: invalid key/nonce scalar');
  const pHex = Point.BASE.multiply(d).toHex(true);
  if (pHex.startsWith('03')) d = N - d; // odd-y pubkey ⇒ negate d (BIP-340)
  const rHex = Point.BASE.multiply(k).toHex(true);
  if (rHex.startsWith('03')) k = N - k; // odd-y nonce point ⇒ negate k
  const rx = hexToBytes(rHex.slice(2));
  const px = hexToBytes(pHex.slice(2));
  const challenge = new Uint8Array(96);
  challenge.set(rx, 0);
  challenge.set(px, 32);
  challenge.set(msg32, 64);
  const e = toBig(taggedHash('BIP0340/challenge', challenge)) % N;
  const s = (k + ((e * d) % N)) % N;
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(to32(s), 32);
  return sig;
}

/** ANNOUNCE: mint a fresh nonce k for this market (idempotent — an existing
 *  commitment is reused, never overwritten), persist k in the vault, return R_x.
 *  The mnemonic is consumed here; only PUBLIC data leaves. */
export async function oracleAnnounce(marketId: string): Promise<{ nonce: string }> {
  const h = marketHash(marketId);
  const existing = await loadOracleNonce(h).catch(() => null);
  let kHex = existing;
  if (!kHex) {
    const k = new Uint8Array(32);
    (globalThis as { crypto: { getRandomValues(a: Uint8Array): Uint8Array } }).crypto.getRandomValues(k);
    kHex = bytesToHex(k);
    await storeOracleNonce(h, kHex);
    k.fill(0);
  }
  const rHex = Point.BASE.multiply(toBig(hexToBytes(kHex)) % N).toHex(true);
  return { nonce: rHex.slice(2) }; // x-only — even/odd handled at signing time
}

/** ATTEST: sign `outcome` for the market under the committed nonce. HARD-refuses a
 *  different second outcome (key-leak guard); same outcome is idempotent. */
export async function oracleAttest(
  mnemonic: string,
  marketId: string,
  outcome: 'YES' | 'NO' | 'INVALID',
): Promise<{ signature: string }> {
  const h = marketHash(marketId);
  if (!(await hasOracleNonce(h))) throw new Error('oracle: no committed nonce for this market — announce first');
  const prior = await getAttestedOutcome(h);
  if (prior && prior !== outcome) {
    throw new Error(`oracle: already attested ${prior} — signing a second outcome would LEAK the key`);
  }
  const kHex = await loadOracleNonce(h);
  if (!kHex) throw new Error('oracle: nonce secret unreadable');
  const sk = loadNostrPrivkeyBytes(mnemonic);
  try {
    const sig = signWithCommittedNonce(sk, hexToBytes(kHex), attestationDigest(marketId, outcome));
    // Record BEFORE returning — a crash after signing must still block equivocation.
    await setAttestedOutcome(h, outcome);
    // Self-check the exact verification bettors run (schnorr.verify on the digest).
    const pub = schnorr.getPublicKey(sk);
    if (!schnorr.verify(sig, attestationDigest(marketId, outcome), pub)) {
      throw new Error('oracle: self-verify failed — attestation NOT published');
    }
    return { signature: bytesToHex(sig) };
  } finally {
    sk.fill(0);
  }
}
