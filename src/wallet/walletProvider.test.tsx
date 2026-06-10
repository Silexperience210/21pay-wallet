// Req ONBD-01, ONBD-05, ONBD-04 — provider seam, mocked SDK / persistence / connections.
jest.mock('@getalby/sdk'); // NwcRemote constructs a (mocked) NWCClient — never a real socket
jest.mock('./backendPersist', () => ({
  persistCustodialConfig: jest.fn(async () => {}),
  loadPersistedCustodialConfig: jest.fn(async () => null),
  persistActiveBackendKind: jest.fn(async () => {}),
  loadActiveBackendKind: jest.fn(async () => null),
}));
jest.mock('./connections', () => ({
  addConnection: jest.fn(async () => {}),
  setActiveConnection: jest.fn(),
  getActiveConnectionConfig: jest.fn(async () => null),
}));
jest.mock('../core/keys', () => ({
  cryptoSelfTest: jest.fn(() => ({ ok: true, details: [] })),
  generateMnemonic: jest.fn(
    () => 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  ),
  storeMnemonic: jest.fn(async () => 'SECURE_HARDWARE'),
  hasMnemonic: jest.fn(async () => true),
  loadSparkSeed: jest.fn(async () => null),
}));

import {
  useWallet,
  activateCustodial,
  activateNwc,
  activateSelfHosted,
  createAndActivateCustodial,
  rehydrate,
  __resetWalletForTests,
} from './walletProvider';
import { useWalletStore } from '../core/state';
import * as backendPersist from './backendPersist';
import * as connections from './connections';
import * as keys from '../core/keys';

const cfg = { baseUrl: 'https://lnbits.test', adminKey: 'a', invoiceKey: 'i', readKey: 'r' };
const NWC_CFG = {
  id: 'c1',
  name: 'Alby',
  walletPubkey: 'a'.repeat(64),
  relayUrl: 'wss://r',
  uri: `nostr+walletconnect://${'a'.repeat(64)}?relay=wss://r&secret=${'b'.repeat(64)}`,
};
const SPARK_CFG = { mnemonic: 'seed words', storageDir: 'spark', apiKey: 'k', network: 'signet' as const };

beforeEach(() => {
  jest.clearAllMocks();
  __resetWalletForTests();
  useWalletStore.setState({ activeBackendKind: null, balances: {}, txByBackend: {} });
});

describe('walletProvider (useWallet seam)', () => {
  it('useWallet() throws before any backend is activated', () => {
    expect(() => useWallet()).toThrow();
  });

  it('activateCustodial sets the active backend and turns on the custody badge', () => {
    activateCustodial(cfg);
    expect(useWallet().kind).toBe('custodial-lnbits');
    expect(useWalletStore.getState().activeBackendKind).toBe('custodial-lnbits');
  });

  it('createAndActivateCustodial ends with an active custodial backend (ONBD-01)', async () => {
    process.env.EXPO_PUBLIC_LNBITS_URL = 'https://lnbits.test';
    (global as { fetch?: unknown }).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'w', user: 'u', adminkey: 'NEWadmin', inkey: 'NEWin', name: '21pay' }),
    }));
    await createAndActivateCustodial();
    expect(useWallet().kind).toBe('custodial-lnbits');
    expect(useWalletStore.getState().activeBackendKind).toBe('custodial-lnbits');
  });
});

describe('walletProvider sovereignty-ladder seam (ONBD-04)', () => {
  it('ONBD-04: activateNwc(config) sets active to an NwcRemote and badge kind to "nwc"', () => {
    activateNwc(NWC_CFG);
    expect(useWallet().kind).toBe('nwc');
    expect(useWalletStore.getState().activeBackendKind).toBe('nwc');
  });

  it('ONBD-04: activateSelfHosted(config) sets active to a SelfHosted(Spark) and badge kind to "self-hosted"', () => {
    activateSelfHosted(SPARK_CFG);
    expect(useWallet().kind).toBe('self-hosted');
    expect(useWalletStore.getState().activeBackendKind).toBe('self-hosted');
  });

  it('ONBD-04: rehydrate() branches by persisted backend kind (custodial / nwc / self-hosted)', async () => {
    // nwc → activateNwc with the loaded connection config
    (backendPersist.loadActiveBackendKind as jest.Mock).mockResolvedValueOnce('nwc');
    (connections.getActiveConnectionConfig as jest.Mock).mockResolvedValueOnce(NWC_CFG);
    expect((await rehydrate())?.kind).toBe('nwc');

    __resetWalletForTests();
    // self-hosted → activateSelfHosted with the loaded Spark seed
    (backendPersist.loadActiveBackendKind as jest.Mock).mockResolvedValueOnce('self-hosted');
    (keys.loadSparkSeed as jest.Mock).mockResolvedValueOnce('spark seed words');
    expect((await rehydrate())?.kind).toBe('self-hosted');

    __resetWalletForTests();
    // custodial → existing custodial path with the persisted config
    (backendPersist.loadActiveBackendKind as jest.Mock).mockResolvedValueOnce('custodial-lnbits');
    (backendPersist.loadPersistedCustodialConfig as jest.Mock).mockResolvedValueOnce(cfg);
    expect((await rehydrate())?.kind).toBe('custodial-lnbits');
  });
});
