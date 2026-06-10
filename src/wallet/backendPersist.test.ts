import * as SecureStore from 'expo-secure-store';
import {
  persistCustodialConfig,
  loadPersistedCustodialConfig,
  clearPersistedBackends,
} from './backendPersist';
import { rehydrate, getActiveCustodialConfig, __resetWalletForTests } from './walletProvider';
import { useWalletStore } from '../core/state';
import type { CustodialLnbitsConfig } from './lnbitsConfig';

const CONFIG: CustodialLnbitsConfig = {
  baseUrl: 'https://21pay.org',
  adminKey: 'admin-abc',
  invoiceKey: 'invoice-def',
  readKey: 'invoice-def',
};

beforeEach(() => {
  (SecureStore as unknown as { __reset: () => void }).__reset();
  __resetWalletForTests();
  useWalletStore.setState({ activeBackendKind: null });
});

describe('backendPersist', () => {
  it('round-trips the custodial config', async () => {
    await persistCustodialConfig(CONFIG);
    expect(await loadPersistedCustodialConfig()).toEqual(CONFIG);
  });

  it('returns null when nothing was persisted', async () => {
    expect(await loadPersistedCustodialConfig()).toBeNull();
  });

  it('returns null for a malformed / incomplete stored config', async () => {
    await SecureStore.setItemAsync('custodial.config', '{"baseUrl":"x"}', {
      keychainService: 'org.pay21.wallet.backends',
    });
    expect(await loadPersistedCustodialConfig()).toBeNull();
  });

  it('clears the persisted config', async () => {
    await persistCustodialConfig(CONFIG);
    await clearPersistedBackends();
    expect(await loadPersistedCustodialConfig()).toBeNull();
  });
});

describe('rehydrate', () => {
  it('returns null and leaves no active backend when nothing is persisted', async () => {
    expect(await rehydrate()).toBeNull();
    expect(useWalletStore.getState().activeBackendKind).toBeNull();
  });

  it('re-activates the persisted custodial wallet (balance survives restart)', async () => {
    await persistCustodialConfig(CONFIG);
    const backend = await rehydrate();
    expect(backend?.kind).toBe('custodial-lnbits');
    expect(getActiveCustodialConfig()).toEqual(CONFIG);
    expect(useWalletStore.getState().activeBackendKind).toBe('custodial-lnbits');
  });
});
