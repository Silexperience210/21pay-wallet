// The single seam sections use to reach the wallet: useWallet(). Sections never
// import a concrete backend (CLAUDE.md constraint 5). Activating custodial turns
// on the custody badge via the store (ONBD-05).
import React, { createContext } from 'react';
import type { WalletBackend } from './WalletBackend';
import type { CustodialLnbitsConfig } from './lnbitsConfig';
import { CustodialLnbits } from './backends/custodialLnbits';
import { createCustodialAccount } from './backends/custodialProvision';
import { NwcRemote, type NwcConnectionConfig } from './backends/nwcRemote';
import { SelfHostedSpark } from './backends/selfHostedSpark';
import type { SparkConfig } from './sparkConfig';
import { parseNwcUri } from './backends/nwcConfig';
import { addConnection, setActiveConnection, getActiveConnectionConfig } from './connections';
import {
  persistCustodialConfig,
  loadPersistedCustodialConfig,
  persistActiveBackendKind,
  loadActiveBackendKind,
} from './backendPersist';
import { useWalletStore, insertTx } from '../core/state';
import { cryptoSelfTest, generateMnemonic, storeMnemonic, hasMnemonic, loadSparkSeed } from '../core/keys';

// Local Spark data directory. 04-05 wires the real expo-file-system documentDirectory.
const SPARK_STORAGE_DIR = 'spark';

// Module-scoped active backend holder (the running app has exactly one active wallet).
let active: WalletBackend | null = null;
// Retained custodial config for backend-credentialed provisioning (e.g. LNURLp
// address claim). This is an LNbits API credential, not Core key material — it does
// not cross the Core signing boundary (CLAUDE.md constraint 5).
let activeCustodialConfig: CustodialLnbitsConfig | null = null;
// Retained Spark config for the active self-hosted backend (D-05). Not Core key material.
let activeSparkConfig: SparkConfig | null = null;

export function activateCustodial(config: CustodialLnbitsConfig): WalletBackend {
  active = new CustodialLnbits(config);
  activeCustodialConfig = config;
  activeSparkConfig = null;
  useWalletStore.getState().setActiveBackend('custodial-lnbits'); // badge on (ONBD-05)
  void persistActiveBackendKind('custodial-lnbits'); // D-05: remember which backend is active
  return active;
}

/** Activate a bring-your-own-node NWC backend (ONBD-02). Additive — sections unchanged. */
export function activateNwc(config: NwcConnectionConfig): WalletBackend {
  active = new NwcRemote(config);
  activeCustodialConfig = null;
  activeSparkConfig = null;
  useWalletStore.getState().setActiveBackend('nwc'); // badge: 'nwc'
  void persistActiveBackendKind('nwc');
  return active;
}

/** Activate the self-sovereign Spark backend (ONBD-03, experimental). Additive. */
export function activateSelfHosted(config: SparkConfig): WalletBackend {
  active = new SelfHostedSpark(config);
  activeCustodialConfig = null;
  activeSparkConfig = config;
  useWalletStore.getState().setActiveBackend('self-hosted'); // badge: 'self-hosted'
  void persistActiveBackendKind('self-hosted');
  return active;
}

/** The active custodial LNbits config, if the active backend is custodial. For
 *  provisioning flows (LNURLp claim) that need the wallet key. Null otherwise. */
export function getActiveCustodialConfig(): CustodialLnbitsConfig | null {
  return activeCustodialConfig;
}

/** The active Spark config, if the active backend is self-hosted. Null otherwise. */
export function getActiveSparkConfig(): SparkConfig | null {
  return activeSparkConfig;
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

/** ONBD-02: pair a bring-your-own-node NWC connection then activate it. Persists the
 *  named connection (metadata in SQLite, secret/URI in the Vault) and makes it active. */
export async function createAndActivateNwc(uri: string, name: string): Promise<WalletBackend> {
  await ensureMasterKey(); // master identity key exists before any backend is wired
  const parsed = parseNwcUri(uri); // fail-closed validation before anything is stored
  const id = `nwc-${parsed.walletPubkey.slice(0, 8)}-${Date.now()}`;
  const config: NwcConnectionConfig = {
    id,
    name,
    walletPubkey: parsed.walletPubkey,
    relayUrl: parsed.relay,
    uri,
  };
  await addConnection({ id, name, walletPubkey: parsed.walletPubkey, relayUrl: parsed.relay }, uri);
  setActiveConnection(id);
  const backend = activateNwc(config);
  await persistActiveBackendKind('nwc');
  return backend;
}

/** Assemble a SparkConfig from a stored seed + environment (04-05 refines storageDir). */
function buildSparkConfig(mnemonic: string): SparkConfig {
  return {
    mnemonic,
    storageDir: SPARK_STORAGE_DIR,
    apiKey: process.env.EXPO_PUBLIC_BREEZ_API_KEY ?? '',
    network: (process.env.EXPO_PUBLIC_BREEZ_NETWORK as 'mainnet' | 'signet') ?? 'signet',
  };
}

/** Re-activate the persisted wallet on app launch, branching by the last active backend
 *  kind (D-05 — nothing is forgotten). Returns the active backend, or null if nothing was
 *  persisted (→ caller shows onboarding). Never throws; a storage hiccup degrades to
 *  onboarding rather than crashing the launch. */
export async function rehydrate(): Promise<WalletBackend | null> {
  if (active) return active;
  try {
    const kind = await loadActiveBackendKind();
    if (kind === 'nwc') {
      const cfg = await getActiveConnectionConfig();
      return cfg ? activateNwc(cfg) : null;
    }
    if (kind === 'self-hosted') {
      const mnemonic = await loadSparkSeed();
      return mnemonic ? activateSelfHosted(buildSparkConfig(mnemonic)) : null;
    }
    // custodial (kind === 'custodial-lnbits' OR legacy null marker): restore the LNbits config
    const config = await loadPersistedCustodialConfig();
    return config ? activateCustodial(config) : null;
  } catch {
    return null; // degrade to onboarding, never crash the launch
  }
}

/** The ONLY wallet accessor sections use. Throws before onboarding. */
export function useWallet(): WalletBackend {
  if (!active) throw new Error('no active wallet — complete onboarding first');
  return active;
}

export function __resetWalletForTests(): void {
  active = null;
  activeCustodialConfig = null;
  activeSparkConfig = null;
}

const WalletContext = createContext<WalletBackend | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return <WalletContext.Provider value={active}>{children}</WalletContext.Provider>;
}
