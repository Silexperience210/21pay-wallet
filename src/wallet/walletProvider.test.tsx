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

// RED seam stub (ONBD-04) — Wave-0 gap enumeration for the sovereignty-ladder
// activate* seam. activateNwc / activateSelfHosted / rehydrate-by-kind do not
// exist yet; these it.todo entries are FILLED in 04-03 Task 3 once those
// functions land on walletProvider.tsx. See 04-VALIDATION.md Wave-0.
describe('walletProvider sovereignty-ladder seam (ONBD-04) [RED stub, filled in 04-03 T3]', () => {
  it.todo('ONBD-04: activateNwc(config) sets module-scoped active to an NwcRemote and badge kind to "nwc"');
  it.todo('ONBD-04: activateSelfHosted(config) sets active to a SelfHosted(Spark) and badge kind to "self-hosted"');
  it.todo('ONBD-04: rehydrate() branches by persisted backend kind (custodial -> custodial path, nwc -> activateNwc, self-hosted -> activateSelfHosted)');
});
