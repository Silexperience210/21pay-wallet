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
const PRESENCE_KEY = 'mnemonic.present';

// Named-secret namespacing (Phase 4 D-04/D-12). Each named secret gets its OWN DEK entry
// (distinct keychain service) so it never overwrites the mnemonic DEK; ciphertexts share
// the SECURE_STORE_SERVICE under distinct keys. NWC per-connection secrets and the dedicated
// Spark seed are stored this way — biometric-gated, AES-256-GCM, never in SQLite (anti-pattern 4).
const nwcDekService = (id: string): string => `org.pay21.wallet.dek.nwc.${id}`;
const nwcCtKey = (id: string): string => `nwc.secret.${id}`;
const nwcPresenceKey = (id: string): string => `nwc.present.${id}`;
const SPARK_DEK_SERVICE = 'org.pay21.wallet.dek.spark';
const SPARK_CT_KEY = 'spark.seed';
const SPARK_PRESENCE_KEY = 'spark.present';

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
    // Non-secret presence marker (no auth gate): lets ensureMasterKey() check the
    // vault without triggering a biometric prompt, and guards against overwriting
    // an existing master key.
    await SecureStore.setItemAsync(PRESENCE_KEY, '1', {
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

/** Prompt-free vault presence check (reads only the non-secret marker). */
export async function hasMnemonic(): Promise<boolean> {
  const marker = await SecureStore.getItemAsync(PRESENCE_KEY, {
    keychainService: SECURE_STORE_SERVICE,
  });
  return marker === '1';
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

// --- Named secrets (Phase 4) — same biometric DEK + AES-256-GCM path as the mnemonic,
//     namespaced so each secret is independent and individually revocable (D-04). ---

async function putNamedSecret(
  dekService: string,
  ctKey: string,
  presenceKey: string,
  value: string,
): Promise<void> {
  const dek = generateDek();
  try {
    const ciphertextB64 = encryptMnemonic(value, dek); // generic string encryptor (iv||ct base64)
    await SecureStore.setItemAsync(ctKey, ciphertextB64, {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock 21pay',
      keychainService: SECURE_STORE_SERVICE,
    });
    await SecureStore.setItemAsync(presenceKey, '1', { keychainService: SECURE_STORE_SERVICE });
    const dekB64 = Buffer.from(dek).toString('base64');
    try {
      await Keychain.setGenericPassword('dek', dekB64, {
        ...dekBase,
        service: dekService,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      });
    } catch {
      await Keychain.setGenericPassword('dek', dekB64, {
        ...dekBase,
        service: dekService,
        securityLevel: Keychain.SECURITY_LEVEL.ANY,
      });
    }
  } finally {
    dek.fill(0);
  }
}

async function getNamedSecret(dekService: string, ctKey: string): Promise<string | null> {
  const dekEntry = await Keychain.getGenericPassword({ service: dekService });
  if (!dekEntry) return null;
  const ciphertextB64 = await SecureStore.getItemAsync(ctKey, { keychainService: SECURE_STORE_SERVICE });
  if (!ciphertextB64) return null;
  const dek = new Uint8Array(Buffer.from(dekEntry.password, 'base64'));
  try {
    return decryptMnemonic(ciphertextB64, dek);
  } finally {
    dek.fill(0);
  }
}

async function removeNamedSecret(dekService: string, ctKey: string, presenceKey: string): Promise<void> {
  await SecureStore.deleteItemAsync(ctKey, { keychainService: SECURE_STORE_SERVICE });
  await SecureStore.deleteItemAsync(presenceKey, { keychainService: SECURE_STORE_SERVICE });
  await Keychain.resetGenericPassword({ service: dekService });
}

/** Store a per-connection NWC secret/URI (D-04). Opaque material — not a raw identity key. */
export async function storeNwcSecret(id: string, secret: string): Promise<void> {
  await putNamedSecret(nwcDekService(id), nwcCtKey(id), nwcPresenceKey(id), secret);
}
/** Load a per-connection NWC secret/URI (biometric-gated), or null if absent. */
export async function loadNwcSecret(id: string): Promise<string | null> {
  return getNamedSecret(nwcDekService(id), nwcCtKey(id));
}
/** Revoke a connection's vault secret (D-04). */
export async function deleteNwcSecret(id: string): Promise<void> {
  await removeNamedSecret(nwcDekService(id), nwcCtKey(id), nwcPresenceKey(id));
}

/** Store the DEDICATED Spark seed (D-12 — separate from the identity master seed). */
export async function storeSparkSeed(mnemonic: string): Promise<void> {
  await putNamedSecret(SPARK_DEK_SERVICE, SPARK_CT_KEY, SPARK_PRESENCE_KEY, mnemonic);
}
/** Load the dedicated Spark seed (biometric-gated), or null if not provisioned. */
export async function loadSparkSeed(): Promise<string | null> {
  return getNamedSecret(SPARK_DEK_SERVICE, SPARK_CT_KEY);
}
/** Prompt-free presence check for the Spark seed (reads only the non-secret marker). */
export async function hasSparkSeed(): Promise<boolean> {
  const marker = await SecureStore.getItemAsync(SPARK_PRESENCE_KEY, { keychainService: SECURE_STORE_SERVICE });
  return marker === '1';
}
/** Forget the Spark seed (self-hosted disconnect). */
export async function deleteSparkSeed(): Promise<void> {
  await removeNamedSecret(SPARK_DEK_SERVICE, SPARK_CT_KEY, SPARK_PRESENCE_KEY);
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
