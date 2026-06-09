// SEC-07 self-test. Environment-pure (no React, no native imports) so it runs
// BOTH under Jest (logic) and on a release Hermes build on a physical device.
// Asserts: native CSPRNG + canonical NIP-06 keygen + Nostr sign/verify round-trip.
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { privateKeyFromSeedWords } from 'nostr-tools/nip06';
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { NIP06_VECTOR_1 } from './fixtures/nip06-vectors';

export interface SelfTestResult {
  ok: boolean;
  level: 'native' | 'weak';
  details: string[];
}

export function cryptoSelfTest(): SelfTestResult {
  const details: string[] = [];

  // 1) CSPRNG must be the native polyfill, not a constant shim.
  const webcrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  let level: 'native' | 'weak' = 'weak';
  let rngOk = false;
  if (webcrypto?.getRandomValues) {
    const a = new Uint8Array(16);
    const b = new Uint8Array(16);
    webcrypto.getRandomValues(a);
    webcrypto.getRandomValues(b);
    const differ = !a.every((v, i) => v === b[i]);
    const nonZero = a.some((v) => v !== 0);
    rngOk = differ && nonZero;
  }
  level = rngOk ? 'native' : 'weak';
  details.push(`RNG: ${rngOk ? 'native getRandomValues OK' : 'WEAK/constant — ABORT keygen'}`);

  // 2) BIP39 reference mnemonic validates.
  const mnemonicOk = validateMnemonic(NIP06_VECTOR_1.mnemonic, wordlist);
  details.push(`BIP39: ${mnemonicOk ? 'valid' : 'INVALID'}`);

  // 3) NIP-06 derivation locks to the canonical reference nsec.
  const sk = privateKeyFromSeedWords(NIP06_VECTOR_1.mnemonic, undefined, 0);
  const nsecOk = nip19.nsecEncode(sk) === NIP06_VECTOR_1.nsec;
  details.push(`NIP-06: ${nsecOk ? 'reference vector match' : 'MISMATCH'}`);

  // 4) Sign + verify round-trip.
  let signOk = false;
  try {
    const ev = finalizeEvent(
      { kind: 1, created_at: 1700000000, tags: [], content: 'selftest' },
      sk,
    );
    signOk = verifyEvent(ev);
  } finally {
    sk.fill(0);
  }
  details.push(`sign/verify: ${signOk ? 'OK' : 'FAIL'}`);

  return { ok: rngOk && mnemonicOk && nsecOk && signOk, level, details };
}
