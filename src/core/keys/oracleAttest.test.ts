// The fixed-nonce BIP-340 signature must verify under the EXACT checks bettors run
// (schnorr.verify on the digest) AND land on the signature point S = R + e·P the
// DLC lock keys were derived from — otherwise minted tokens would never unlock.
import { schnorr, secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { signWithCommittedNonce, attestationDigest } from './oracleAttest';
import { signaturePoint, outcomeUnlockSecret, outcomeLockKey, compressedPubkey } from '../../sections/markets/lib/dlc';

const Point = secp256k1.Point;
const MARKET = 'a'.repeat(64) + ':30888:test-market';

function xonly(scalarHex: string): string {
  return Point.BASE.multiply(BigInt('0x' + scalarHex)).toHex(true).slice(2);
}

describe('oracle fixed-nonce attestation (DLC-compatible BIP-340)', () => {
  const d = '7d4'.padEnd(64, '1'); // deterministic test scalars (NOT live keys)
  const k = '3c9'.padEnd(64, '2');

  it('verifies under schnorr.verify and matches the precomputed signature point', () => {
    for (const outcome of ['YES', 'NO', 'INVALID'] as const) {
      const msg = attestationDigest(MARKET, outcome);
      const sig = signWithCommittedNonce(hexToBytes(d), hexToBytes(k), msg);
      // 1) the bettor-side event check
      expect(schnorr.verify(sig, msg, hexToBytes(xonly(d)))).toBe(true);
      // 2) sig starts with the announced R_x
      expect(bytesToHex(sig.slice(0, 32))).toBe(xonly(k));
      // 3) s·G equals S = R + e·P — the point the lock keys were built from
      const s = BigInt('0x' + bytesToHex(sig.slice(32)));
      expect(Point.BASE.multiply(s).toHex(true)).toBe(signaturePoint(xonly(d), xonly(k), MARKET, outcome));
    }
  });

  it('the full DLC loop closes: l_X·G == L_X for the attested outcome', () => {
    const b = '5e1'.padEnd(64, '7');
    const sig = signWithCommittedNonce(hexToBytes(d), hexToBytes(k), attestationDigest(MARKET, 'YES'));
    const l = outcomeUnlockSecret(b, bytesToHex(sig));
    const L = outcomeLockKey(compressedPubkey(b), xonly(d), xonly(k), MARKET, 'YES');
    expect(Point.BASE.multiply(BigInt('0x' + l)).toHex(true)).toBe(L);
  });
});
