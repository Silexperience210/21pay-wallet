// Req ONBD-05 (per-backend isolation) + WALLET-09 (status persistence). expo-sqlite mocked.
import * as sqlite from 'expo-sqlite';
import { openDb, insertTx, listTxByBackend, listPending, updateTxStatus } from './db';
import type { WalletTx } from '../../wallet/types';

const tx = (id: string, status: WalletTx['status'] = 'pending', memo?: string): WalletTx => ({
  id,
  paymentHash: `hash-${id}`,
  direction: 'out',
  amountSat: 1000,
  status,
  createdAt: Date.now(),
  memo,
});

beforeEach(() => {
  (sqlite as unknown as { __reset: () => void }).__reset();
  openDb();
});

describe('db (per-backend tx persistence)', () => {
  it('creates the table and persists a tx', () => {
    insertTx('custodial-lnbits', tx('a'));
    expect(listTxByBackend('custodial-lnbits')).toHaveLength(1);
  });

  it('isolates tx by backend kind (never cross-backend)', () => {
    insertTx('custodial-lnbits', tx('a'));
    insertTx('nwc', tx('b'));
    expect(listTxByBackend('custodial-lnbits').map((t) => t.id)).toEqual(['a']);
    expect(listTxByBackend('nwc').map((t) => t.id)).toEqual(['b']);
  });

  it('flips pending → settled and drops it from listPending', () => {
    insertTx('custodial-lnbits', tx('a', 'pending'));
    expect(listPending('custodial-lnbits')).toHaveLength(1);
    updateTxStatus('a', 'settled');
    expect(listPending('custodial-lnbits')).toHaveLength(0);
    expect(listTxByBackend('custodial-lnbits')[0].status).toBe('settled');
  });

  it('stores a memo containing a quote intact (parameterized — no injection)', () => {
    insertTx('custodial-lnbits', tx('a', 'pending', "o'brien's pizza"));
    expect(listTxByBackend('custodial-lnbits')[0].memo).toBe("o'brien's pizza");
  });
});
