// Req ONBD-05 — separate per-backend balances + always-on custody badge.
import * as sqlite from 'expo-sqlite';
import { useWalletStore, custodyBadge } from './store';
import { openDb, insertTx } from './db';

beforeEach(() => {
  (sqlite as unknown as { __reset: () => void }).__reset();
  openDb();
  useWalletStore.setState({ activeBackendKind: null, balances: {}, txByBackend: {} });
});

describe('wallet store (ONBD-05)', () => {
  it('exposes a non-null custody badge whenever a backend is active', () => {
    expect(custodyBadge(useWalletStore.getState())).toBeNull();
    useWalletStore.getState().setActiveBackend('custodial-lnbits');
    const badge = custodyBadge(useWalletStore.getState());
    expect(badge).not.toBeNull();
    expect(badge?.label).toBe('21pay Custodial');
  });

  it('keeps each backend balance in its own slot (never merged)', () => {
    const s = useWalletStore.getState();
    s.setBalance('custodial-lnbits', { backendKind: 'custodial-lnbits', lightningSat: 5000 });
    s.setBalance('nwc', { backendKind: 'nwc', lightningSat: 9000 });
    const { balances } = useWalletStore.getState();
    expect(balances['custodial-lnbits']?.lightningSat).toBe(5000);
    expect(balances['nwc']?.lightningSat).toBe(9000);
    // No merged-total accessor exists on the store.
    expect((useWalletStore.getState() as unknown as Record<string, unknown>).totalBalance).toBeUndefined();
    expect((useWalletStore.getState() as unknown as Record<string, unknown>).spendableSat).toBeUndefined();
  });

  it('hydrates per-backend history from SQLite', () => {
    insertTx('custodial-lnbits', {
      id: 'x',
      direction: 'in',
      amountSat: 2000,
      status: 'settled',
      createdAt: Date.now(),
    });
    useWalletStore.getState().hydrateHistory('custodial-lnbits');
    expect(useWalletStore.getState().txByBackend['custodial-lnbits']).toHaveLength(1);
  });
});
