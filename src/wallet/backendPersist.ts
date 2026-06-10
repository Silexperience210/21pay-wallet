// Persisted backend credentials so the active wallet survives an app restart.
//
// The custodial LNbits config (admin/invoice keys) is a per-user runtime secret, but
// it is an LNbits API credential — NOT Core key material, and it never crosses the
// Core signing boundary (same framing as `activeCustodialConfig` in walletProvider).
// It therefore lives in expo-secure-store (OS-encrypted at rest, Android Keystore-backed)
// WITHOUT a biometric gate, so the balance silently reloads on launch. The master
// mnemonic — the actual self-custody crown jewel — stays in the biometric-gated Vault.
//
// This is also the seam Phase 4 (D-05) extends to persist NWC connections + Spark config.
import * as SecureStore from 'expo-secure-store';
import type { CustodialLnbitsConfig } from './lnbitsConfig';

const BACKEND_SERVICE = 'org.pay21.wallet.backends';
const CUSTODIAL_KEY = 'custodial.config';

/** Save the active custodial config so it can be rehydrated after an app restart. */
export async function persistCustodialConfig(config: CustodialLnbitsConfig): Promise<void> {
  await SecureStore.setItemAsync(CUSTODIAL_KEY, JSON.stringify(config), {
    keychainService: BACKEND_SERVICE,
  });
}

/** Load the persisted custodial config, or null if none was ever saved / it's malformed. */
export async function loadPersistedCustodialConfig(): Promise<CustodialLnbitsConfig | null> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(CUSTODIAL_KEY, { keychainService: BACKEND_SERVICE });
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<CustodialLnbitsConfig>;
    if (!c?.baseUrl || !c?.adminKey || !c?.invoiceKey) return null;
    return { baseUrl: c.baseUrl, adminKey: c.adminKey, invoiceKey: c.invoiceKey, readKey: c.readKey ?? c.invoiceKey };
  } catch {
    return null;
  }
}

/** Forget the persisted custodial config (e.g. on logout / wallet reset). */
export async function clearPersistedBackends(): Promise<void> {
  await SecureStore.deleteItemAsync(CUSTODIAL_KEY, { keychainService: BACKEND_SERVICE });
}
