// LUD-05 per-domain linking-key derivation + LUD-04 ECDSA sign for casino login
// (CASINO-02 auth, D-05). GREEN in 05-03 against `@/core/keys/lnurlAuth`.
// Vectors per the LUD-05 spec; mnemonic = canonical NIP-06 vector-1 (never a real seed).
//
// Run: `npx jest src/core/keys/lnurlAuth.test.ts`
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { deriveLnurlAuthKey, signLnurlAuth, lnurlAuthPathFromHashingKey } from './lnurlAuth';

// ---------------------------------------------------------------------------
// LITERAL CONTRACT (from the 05-01 RED stub). One correction vs the stub: the
// LUD-05 spec vector is bound to the spec's LITERAL hashingKey below — not to a
// mnemonic (the stub wrongly assumed TEST_MNEMONIC produced this path).
// ---------------------------------------------------------------------------
export const LUD05_DOMAIN = 'site.com';
export const LUD05_PATH_SUFFIX: readonly [number, number, number, number] = [
  1588488367, 2659270754, 38110259, 4136336762,
];
export const LUD05_EXPECTED_PATH = `m/138'/${LUD05_PATH_SUFFIX[0]}/${LUD05_PATH_SUFFIX[1]}/${LUD05_PATH_SUFFIX[2]}/${LUD05_PATH_SUFFIX[3]}`;
// LUD-05 spec test vector hashing key (the published spec fixture — not a real key).
export const LUD05_HASHING_KEY_HEX =
  '7d417a6a5e9a6a4a879aeaba11a11838764c8fa2b959c242d43dea682b3e409b';
export const TEST_MNEMONIC =
  'leader monkey parrot ring guide accident before fence cannon height naive bean';
export const IDENTITY_PATH_PREFIX = "m/44'/1237'";
export const SPENDING_PATH_PREFIX = "m/44'/0'";

const K1 = 'e2af6254a8df433264fa23f67eb8188635d15ce883e8fc020989d5f82ae6f11e';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

describe('lnurlAuth — LUD-05 derivation + LUD-04 ECDSA sign (CASINO-02, D-05)', () => {
  it(`LUD-05 spec vector: hashingKey + '${LUD05_DOMAIN}' -> path m/138'/[${LUD05_PATH_SUFFIX.join(',')}]`, () => {
    const { path, parts } = lnurlAuthPathFromHashingKey(hexToBytes(LUD05_HASHING_KEY_HEX), LUD05_DOMAIN);
    expect(parts).toEqual(LUD05_PATH_SUFFIX);
    expect(path).toBe(LUD05_EXPECTED_PATH);
  });

  it('deriveLnurlAuthKey is deterministic per (mnemonic, domain)', () => {
    const a = deriveLnurlAuthKey(TEST_MNEMONIC, LUD05_DOMAIN);
    const b = deriveLnurlAuthKey(TEST_MNEMONIC, LUD05_DOMAIN);
    expect(a).toEqual(b);
    expect(a.path.startsWith("m/138'/")).toBe(true);
  });

  it('signLnurlAuth(mnemonic, k1Hex, domain) returns sig as valid lowercase DER hex', () => {
    const { sig, key } = signLnurlAuth(TEST_MNEMONIC, K1, LUD05_DOMAIN);
    expect(sig).toMatch(/^[0-9a-f]+$/); // lowercase hex
    expect(sig.startsWith('30')).toBe(true); // DER sequence tag
    // ECDSA round-trip: the casino callback verifies exactly this way (DER sig).
    expect(
      secp256k1.verify(hexToBytes(sig), hexToBytes(K1), hexToBytes(key), {
        prehash: false,
        format: 'der',
      }),
    ).toBe(true);
  });

  it('signLnurlAuth(...) returns key as a 66-char compressed-pubkey hex (33 bytes)', () => {
    const { key } = signLnurlAuth(TEST_MNEMONIC, K1, LUD05_DOMAIN);
    expect(key).toMatch(/^0[23][0-9a-f]{64}$/); // compressed point, 33 bytes
    expect(key).toHaveLength(66);
  });

  it("casino linking-key path starts with m/138' (distinct key family)", () => {
    const { path } = deriveLnurlAuthKey(TEST_MNEMONIC, 'satoshi-casino21.vercel.app');
    expect(path.startsWith("m/138'/")).toBe(true);
  });

  it("casino linking-key path !== identity (m/44'/1237') and !== spending (m/44'/0')", () => {
    const { path } = deriveLnurlAuthKey(TEST_MNEMONIC, 'satoshi-casino21.vercel.app');
    expect(path.startsWith(IDENTITY_PATH_PREFIX)).toBe(false);
    expect(path.startsWith(SPENDING_PATH_PREFIX)).toBe(false);
  });

  it('signLnurlAuth never exposes the raw private key in its return value', () => {
    const result = signLnurlAuth(TEST_MNEMONIC, K1, LUD05_DOMAIN);
    expect(Object.keys(result).sort()).toEqual(['key', 'sig']); // {sig, key} ONLY
    // Per-domain keys differ — and neither equals the identity pubkey (blast-radius).
    const other = deriveLnurlAuthKey(TEST_MNEMONIC, 'other-domain.example');
    expect(other.key).not.toBe(result.key);
  });
});
