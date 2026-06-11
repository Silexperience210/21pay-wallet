// RED stub — Wave-0 gap (Phase 5 / 05-01). LUD-05 per-domain linking-key
// derivation + LUD-04 ECDSA sign for casino login (CASINO-02 auth, D-05).
// Filled GREEN in 05-03 against `@/core/keys/lnurlAuth` (does not exist yet).
// Analog: src/wallet/lnurl/resolveLnurlPay.test.ts (test-vector pattern) +
// src/core/keys/derivation.test.ts (NIP-06 vector + path-separation pattern).
//
// Run: `npx jest src/core/keys/lnurlAuth.test.ts`
//
// These are it.todo() (RED-by-design, suite stays green) until 05-03 implements
// the module and converts each to a real assertion against the literal vectors
// encoded below — same convention as src/wallet/backends/spark.test.ts.

// ---------------------------------------------------------------------------
// LITERAL CONTRACT the 05-03 implementation must satisfy (do NOT change these).
// ---------------------------------------------------------------------------

// LUD-05 spec test vector — domain `site.com`:
//   hashingKey = HDKey.fromMasterSeed(seed).derive("m/138'/0").privateKey
//   path suffix = big-endian uint32 of HMAC-SHA256(hashingKey, "site.com")[0..16]
export const LUD05_DOMAIN = 'site.com';
export const LUD05_PATH_SUFFIX: readonly [number, number, number, number] = [
  1588488367, 2659270754, 38110259, 4136336762,
];
// Full expected derivation path: m/138'/<suffix...>  (NOT identity, NOT spending).
export const LUD05_EXPECTED_PATH = `m/138'/${LUD05_PATH_SUFFIX[0]}/${LUD05_PATH_SUFFIX[1]}/${LUD05_PATH_SUFFIX[2]}/${LUD05_PATH_SUFFIX[3]}`;

// Use a published BIP39/NIP-06 test mnemonic ONLY — never a real seed (threat T-05-02).
// Reuse the canonical NIP-06 vector-1 mnemonic already in the repo fixtures.
export const TEST_MNEMONIC =
  'leader monkey parrot ring guide accident before fence cannon height naive bean';

// Blast-radius (constraint 2): the casino linking-key path MUST start with m/138'
// and MUST NOT equal the identity (m/44'/1237') or spending (m/44'/0') families.
export const IDENTITY_PATH_PREFIX = "m/44'/1237'";
export const SPENDING_PATH_PREFIX = "m/44'/0'";

describe("lnurlAuth — LUD-05 derivation + LUD-04 ECDSA sign (CASINO-02, D-05) [RED stub, filled 05-03]", () => {
  // LUD-05 derivation against the spec test vector (domain site.com).
  it.todo(
    `deriveLnurlAuthKey(TEST_MNEMONIC, '${LUD05_DOMAIN}') derives path m/138'/[${LUD05_PATH_SUFFIX.join(',')}]`,
  );

  // LUD-04 sign: ECDSA over secp256k1 (NOT Schnorr) -> lowercase DER hex sig.
  it.todo('signLnurlAuth(mnemonic, k1Hex, domain) returns sig as valid lowercase DER hex');
  it.todo('signLnurlAuth(...) returns key as a 66-char compressed-pubkey hex (33 bytes)');

  // Blast-radius assertions (constraint 2).
  it.todo("casino linking-key path starts with m/138' (distinct key family)");
  it.todo("casino linking-key path !== identity (m/44'/1237') and !== spending (m/44'/0')");

  // SEC-04: raw private key zeroized after signing (never returned).
  it.todo('signLnurlAuth never exposes the raw private key in its return value');
});
