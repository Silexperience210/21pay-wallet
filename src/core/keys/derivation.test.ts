// Req IDENT-01, IDENT-02 — VALIDATION.md "derivation" row.
// Locks derivation to the canonical NIP-06 reference vectors and asserts
// identity/spending path separation.
import {
  generateMnemonic,
  isValidMnemonic,
  deriveNostrIdentity,
  deriveBitcoinSpendingKey,
  importNsec,
  importMnemonic,
} from './derivation';
import { NIP06_VECTOR_1, NIP06_VECTOR_2 } from './fixtures/nip06-vectors';

describe('derivation (BIP39 + NIP-06 + path separation)', () => {
  it('generates a valid BIP39 mnemonic (12 or 24 words)', () => {
    const m = generateMnemonic();
    expect(typeof m).toBe('string');
    const words = m.trim().split(/\s+/).length;
    expect([12, 24]).toContain(words);
    expect(isValidMnemonic(m)).toBe(true);
  });

  it('derives the NIP-06 reference identity (vector 1)', () => {
    const id = deriveNostrIdentity(NIP06_VECTOR_1.mnemonic);
    expect(id.npub).toBe(NIP06_VECTOR_1.npub);
    expect(id.pubkeyHex).toBe(NIP06_VECTOR_1.pubKeyHex);
  });

  it('derives the NIP-06 reference identity (vector 2)', () => {
    const id = deriveNostrIdentity(NIP06_VECTOR_2.mnemonic);
    expect(id.npub).toBe(NIP06_VECTOR_2.npub);
    expect(id.pubkeyHex).toBe(NIP06_VECTOR_2.pubKeyHex);
  });

  it('derives identity and Bitcoin spending keys on SEPARATE paths (never equal)', () => {
    const spend = deriveBitcoinSpendingKey(NIP06_VECTOR_1.mnemonic);
    expect(spend).toBeInstanceOf(Uint8Array);
    expect(spend.length).toBe(32);
    // identity privkey hex is known from the vector; spending key must differ (IDENT-01)
    const spendHex = Buffer.from(spend).toString('hex');
    expect(spendHex).not.toBe(NIP06_VECTOR_1.privKeyHex);
  });

  it('imports an nsec back to the same npub', () => {
    const id = importNsec(NIP06_VECTOR_1.nsec);
    expect(id.npub).toBe(NIP06_VECTOR_1.npub);
    expect(id.pubkeyHex).toBe(NIP06_VECTOR_1.pubKeyHex);
  });

  it('accepts a valid mnemonic on import and rejects an invalid one', () => {
    expect(importMnemonic(NIP06_VECTOR_1.mnemonic)).toBe(NIP06_VECTOR_1.mnemonic);
    expect(() => importMnemonic('not a valid bip39 seed phrase at all nope nope')).toThrow();
  });
});
