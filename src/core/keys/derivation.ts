// Pure-JS key derivation core (audited libs only — no hand-rolled crypto).
// Nostr identity and Bitcoin spending derive on SEPARATE hardened paths so a
// leaked identity key can never move on-chain funds (IDENT-01 / CLAUDE.md constraint 2).
import { generateMnemonic as bip39Generate, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { privateKeyFromSeedWords } from 'nostr-tools/nip06'; // → m/44'/1237'/{account}'/0/0
import * as nip19 from 'nostr-tools/nip19';
import { getPublicKey } from 'nostr-tools/pure';
import type { KeyIdentity } from './types';

const BITCOIN_SPENDING_PATH = "m/44'/0'/0'/0/0"; // SEPARATE hardened path, never the identity key

export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39Generate(wordlist, strength);
}

export function isValidMnemonic(words: string): boolean {
  return validateMnemonic(words, wordlist);
}

export function deriveNostrIdentity(mnemonic: string): KeyIdentity {
  // canonical NIP-06 m/44'/1237'/0'/0/0 (accountIndex 0)
  const sk = privateKeyFromSeedWords(mnemonic, undefined, 0);
  const pubkeyHex = getPublicKey(sk);
  const npub = nip19.npubEncode(pubkeyHex);
  return { npub, pubkeyHex }; // PUBLIC only — never the privkey
}

export function deriveBitcoinSpendingKey(mnemonic: string): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic);
  const node = HDKey.fromMasterSeed(seed).derive(BITCOIN_SPENDING_PATH);
  if (!node.privateKey) throw new Error('could not derive Bitcoin spending key');
  return node.privateKey;
}

export function importNsec(nsec: string): KeyIdentity {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') throw new Error('not an nsec');
  const sk = decoded.data as Uint8Array;
  const pubkeyHex = getPublicKey(sk);
  const npub = nip19.npubEncode(pubkeyHex);
  return { npub, pubkeyHex };
}

export function importMnemonic(words: string): string {
  const normalized = words.trim().replace(/\s+/g, ' ');
  if (!isValidMnemonic(normalized)) throw new Error('invalid BIP39 mnemonic');
  return normalized;
}

/** @internal consumed by signer/vault only; never re-exported through index.ts */
export function loadNostrPrivkeyBytes(mnemonic: string): Uint8Array {
  // canonical NIP-06 identity privkey m/44'/1237'/0'/0/0
  return privateKeyFromSeedWords(mnemonic, undefined, 0);
}
