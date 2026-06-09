// Hardware-backed Vault — the trust border at rest.
// SEC-01: mnemonic stored as ciphertext only (a random DEK encrypts it; ciphertext
//   in expo-secure-store, DEK in the Android Keystore via react-native-keychain).
// SEC-02: the achieved security level is read at runtime (getSecurityLevel) and
//   surfaced honestly — never a hard-coded "hardware" claim.
// SEC-03: the DEK entry's biometric gate is OS/Keystore-enforced (accessControl),
//   not a JS boolean (Pitfall 2).
// SEC-04: the raw key stays inside Core; never logged, never returned to sections.
import * as Keychain from 'react-native-keychain';
import * as SecureStore from 'expo-secure-store';
import { gcm } from '@noble/ciphers/aes.js';
import { loadNostrPrivkeyBytes } from './derivation';
import type { SecurityLevel, VaultStatus } from './types';

// PERMANENT service-string contract — do not change (RESEARCH Runtime State Inventory).
const DEK_SERVICE = 'org.pay21.wallet.dek';
const SECURE_STORE_SERVICE = 'org.pay21.wallet.vault';
const CIPHERTEXT_KEY = 'mnemonic.ciphertext';

function csprng(out: Uint8Array): Uint8Array {
  const wc = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!wc?.getRandomValues) throw new Error('vault: no native CSPRNG available');
  wc.getRandomValues(out);
  return out;
}

function generateDek(): Uint8Array {
  return csprng(new Uint8Array(32)); // AES-256 key
}

function encryptMnemonic(mnemonic: string, dek: Uint8Array): string {
  const iv = csprng(new Uint8Array(12));
  const ct = gcm(dek, iv).encrypt(new TextEncoder().encode(mnemonic));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return Buffer.from(packed).toString('base64');
}

function decryptMnemonic(b64: string, dek: Uint8Array): string {
  const packed = new Uint8Array(Buffer.from(b64, 'base64'));
  const iv = packed.slice(0, 12);
  const ct = packed.slice(12);
  return new TextDecoder().decode(gcm(dek, iv).decrypt(ct));
}

function normalizeLevel(level: Keychain.SECURITY_LEVEL | string | null): SecurityLevel {
  const s = level == null ? null : String(level);
  return s === 'SECURE_HARDWARE' || s === 'SECURE_SOFTWARE' ? s : 'ANY';
}

const dekBase = {
  service: DEK_SERVICE,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  storage: Keychain.STORAGE_TYPE.AES_GCM, // authenticated; NOT AES_CBC
};

/** Encrypt-then-store the mnemonic; returns the achieved hardware tier. */
export async function storeMnemonic(mnemonic: string): Promise<SecurityLevel> {
  const dek = generateDek();
  try {
    const ciphertextB64 = encryptMnemonic(mnemonic, dek);
    await SecureStore.setItemAsync(CIPHERTEXT_KEY, ciphertextB64, {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock 21pay',
      keychainService: SECURE_STORE_SERVICE,
    });
    const dekB64 = Buffer.from(dek).toString('base64');
    try {
      // Attempt StrongBox / hardware-backed first.
      await Keychain.setGenericPassword('dek', dekB64, {
        ...dekBase,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      });
    } catch {
      // StrongBoxUnavailableException / hardware unavailable → relaxed level, no crash.
      await Keychain.setGenericPassword('dek', dekB64, {
        ...dekBase,
        securityLevel: Keychain.SECURITY_LEVEL.ANY,
      });
    }
  } finally {
    dek.fill(0); // zeroize the key bytes (the b64 string cannot be wiped — honest limit)
  }
  const level = await Keychain.getSecurityLevel({ accessControl: dekBase.accessControl });
  return normalizeLevel(level);
}

/** Biometric-gated load + decrypt. Throws if the vault is empty. */
export async function loadMnemonic(): Promise<string> {
  const dekEntry = await Keychain.getGenericPassword({ service: DEK_SERVICE });
  if (!dekEntry) throw new Error('vault: no DEK present');
  const ciphertextB64 = await SecureStore.getItemAsync(CIPHERTEXT_KEY, {
    keychainService: SECURE_STORE_SERVICE,
  });
  if (!ciphertextB64) throw new Error('vault: no ciphertext present');
  const dek = new Uint8Array(Buffer.from(dekEntry.password, 'base64'));
  try {
    return decryptMnemonic(ciphertextB64, dek);
  } finally {
    dek.fill(0);
  }
}

/** Honest runtime security-level probe. */
export async function detectSecurityLevel(): Promise<VaultStatus> {
  const level = await Keychain.getSecurityLevel({ accessControl: dekBase.accessControl });
  const biometry = await Keychain.getSupportedBiometryType();
  return { securityLevel: normalizeLevel(level), biometryEnrolled: biometry !== null };
}

/**
 * Biometric-gated identity privkey loader for the Signer. Internal — NOT exported
 * through index.ts; sections never call it, they only receive signed events.
 */
export async function loadNostrPrivkey(): Promise<Uint8Array> {
  const mnemonic = await loadMnemonic();
  return loadNostrPrivkeyBytes(mnemonic);
}
