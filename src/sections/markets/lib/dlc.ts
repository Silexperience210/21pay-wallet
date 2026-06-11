// DLC conditional-token crypto — ported from hunch-web (mirrors the Rust `hunch_dlc`,
// cross-checked byte-for-byte against Rust vectors in dlc.test.ts).
//
// For outcome X the oracle's signature point is S_X = R + e_X·P (P = oracle x-only key,
// R = announced nonce x-only, e_X = BIP-340 challenge over the canonical message). A Hunch
// outcome token is NUT-11 P2PK-locked to L_X = B + S_X; the spend key is l_X = b + s_X,
// where s_X is the scalar half of the oracle's kind:89 attestation.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

const Point = secp256k1.Point;
const N = Point.Fn.ORDER;

function bytesToBigInt(b: Uint8Array): bigint {
  return BigInt('0x' + bytesToHex(b));
}

function bigIntTo32(n: bigint): Uint8Array {
  return hexToBytes(n.toString(16).padStart(64, '0'));
}

/** BIP-340 tagged hash: sha256(sha256(tag) || sha256(tag) || msg). */
function taggedHash(tag: string, msg: Uint8Array): Uint8Array {
  const t = sha256(new TextEncoder().encode(tag));
  const buf = new Uint8Array(t.length * 2 + msg.length);
  buf.set(t, 0);
  buf.set(t, t.length);
  buf.set(msg, t.length * 2);
  return sha256(buf);
}

/** The 32-byte digest the oracle signs for (market, outcome) — matches hunch-protocol. */
export function attestationDigest(market: string, outcome: string): Uint8Array {
  return sha256(new TextEncoder().encode(`hunch/oracle/v1\n${market}\n${outcome}`));
}

/** Lifts a 32-byte x-only hex key to its even-y point (BIP-340 convention). */
function liftX(xonlyHex: string) {
  return Point.fromHex('02' + xonlyHex);
}

/** Computes S_X = R + e_X·P as 33-byte compressed hex. */
export function signaturePoint(oracleXonlyHex: string, nonceXonlyHex: string, market: string, outcome: string): string {
  const P = liftX(oracleXonlyHex);
  const R = liftX(nonceXonlyHex);
  const digest = attestationDigest(market, outcome);
  const challengeInput = new Uint8Array(32 * 3);
  challengeInput.set(hexToBytes(nonceXonlyHex), 0); // R_x
  challengeInput.set(hexToBytes(oracleXonlyHex), 32); // P_x
  challengeInput.set(digest, 64); // m
  const e = bytesToBigInt(taggedHash('BIP0340/challenge', challengeInput)) % N;
  const s = R.add(P.multiply(e));
  return s.toHex(true);
}

/** Computes the outcome lock key L_X = B + S_X as 33-byte compressed hex. */
export function outcomeLockKey(
  bettorCompressedHex: string,
  oracleXonlyHex: string,
  nonceXonlyHex: string,
  market: string,
  outcome: string,
): string {
  const sX = Point.fromHex(signaturePoint(oracleXonlyHex, nonceXonlyHex, market, outcome));
  const B = Point.fromHex(bettorCompressedHex);
  return B.add(sX).toHex(true);
}

/** Fresh 32-byte bettor secret (hex) — the per-position Cashu stake key, NOT the Nostr
 *  identity (D-03). Uses the polyfilled CSPRNG (react-native-get-random-values). */
export function randomBettorSecret(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

/** Returns the 33-byte compressed pubkey (B) for a bettor secret hex. */
export function compressedPubkey(secretHex: string): string {
  return bytesToHex(secp256k1.getPublicKey(hexToBytes(secretHex.trim()), true));
}

/** Derives the spend secret l_X = (b + s_X) mod n from the bettor secret + attestation sig. */
export function outcomeUnlockSecret(bettorSecretHex: string, attestationSigHex: string): string {
  const sig = hexToBytes(attestationSigHex.trim());
  if (sig.length !== 64) throw new Error(`attestation signature must be 64 bytes, got ${sig.length}`);
  const sX = bytesToBigInt(sig.slice(32, 64));
  const b = bytesToBigInt(hexToBytes(bettorSecretHex.trim()));
  const l = (b + sX) % N;
  return bytesToHex(bigIntTo32(l));
}
