// Req ONBD-01, ONBD-05 — provider seam, mocked fetch + store.
import {
  useWallet,
  activateCustodial,
  createAndActivateCustodial,
  __resetWalletForTests,
} from './walletProvider';
import { useWalletStore } from '../core/state';

const cfg = {
  baseUrl: 'https://lnbits.test',
  adminKey: 'a',
  invoiceKey: 'i',
  readKey: 'r',
};

beforeEach(() => {
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
