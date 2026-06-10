// The single seam sections use to reach the wallet: useWallet(). Sections never
// import a concrete backend (CLAUDE.md constraint 5). Activating custodial turns
// on the custody badge via the store (ONBD-05).
import React, { createContext } from 'react';
import type { WalletBackend } from './WalletBackend';
import type { CustodialLnbitsConfig } from './lnbitsConfig';
import { CustodialLnbits } from './backends/custodialLnbits';
import { createCustodialAccount } from './backends/custodialProvision';
import { persistCustodialConfig, loadPersistedCustodialConfig } from './backendPersist';
import { useWalletStore, insertTx } from '../core/state';
import { cryptoSelfTest, generateMnemonic, storeMnemonic, hasMnemonic } from '../core/keys';

// Module-scoped active backend holder (the running app has exactly one active wallet).
let active: WalletBackend | null = null;
// Retained custodial config for backend-credentialed provisioning (e.g. LNURLp
// address claim). This is an LNbits API credential, not Core key material — it does
// not cross the Core signing boundary (CLAUDE.md constraint 5).
let activeCustodialConfig: CustodialLnbitsConfig | null = null;

export function activateCustodial(config: CustodialLnbitsConfig): WalletBackend {
  active = new CustodialLnbits(config);
  activeCustodialConfig = config;
  useWalletStore.getState().setActiveBackend('custodial-lnbits'); // badge on (ONBD-05)
  return active;
}

/** The active custodial LNbits config, if the active backend is custodial. For
 *  provisioning flows (LNURLp claim) that need the wallet key. Null otherwise. */
export function getActiveCustodialConfig(): CustodialLnbitsConfig | null {
  return activeCustodialConfig;
}

/** Pull the backend's transaction list into the local SQLite cache (upsert).
 *  The Activity tab and the home 'Recent' strip read only from the cache, so
 *  this is the single seam where remote history lands on-device. */
export async function syncHistory(): Promise<void> {
  if (!active) return;
  const { txs } = await active.listTransactions();
  for (const tx of txs) insertTx(active.kind, tx);
}

/** Generate-and-store the master mnemonic if (and only if) the vault is empty.
 *  Gated by the crypto self-test (CLAUDE.md constraint 4: prove the CSPRNG +
 *  sign round-trip on the device before generating any live key). Idempotent:
 *  the non-secret presence marker prevents ever overwriting an existing key. */
export async function ensureMasterKey(): Promise<void> {
  if (await hasMnemonic()) return;
  const st = cryptoSelfTest();
  if (!st.ok) {
    throw new Error(`crypto self-test failed: ${st.details.join('; ')}`);
  }
  const mnemonic = generateMnemonic(128);
  await storeMnemonic(mnemonic);
}

/** ONBD-01 happy path: open a fresh 21pay account then activate it. */
export async function createAndActivateCustodial(opts?: { name?: string }): Promise<WalletBackend> {
  await ensureMasterKey(); // master identity key exists before any account is opened
  const config = await createCustodialAccount(opts);
  const backend = activateCustodial(config);
  // Persist so the wallet survives an app restart — without this, every relaunch
  // shows onboarding and a second tap would orphan this freshly-funded wallet.
  await persistCustodialConfig(config);
  return backend;
}

/** Re-activate the persisted wallet on app launch. Returns the active backend, or
 *  null if no wallet was ever persisted (→ caller shows onboarding). Never throws;
 *  a storage hiccup degrades to onboarding rather than crashing the launch. */
export async function rehydrate(): Promise<WalletBackend | null> {
  if (active) return active;
  const config = await loadPersistedCustodialConfig().catch(() => null);
  if (!config) return null;
  return activateCustodial(config);
}

/** The ONLY wallet accessor sections use. Throws before onboarding. */
export function useWallet(): WalletBackend {
  if (!active) throw new Error('no active wallet — complete onboarding first');
  return active;
}

export function __resetWalletForTests(): void {
  active = null;
  activeCustodialConfig = null;
}

const WalletContext = createContext<WalletBackend | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return <WalletContext.Provider value={active}>{children}</WalletContext.Provider>;
}
