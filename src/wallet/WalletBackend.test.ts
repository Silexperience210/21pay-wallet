// Req ONBD-05, WALLET-09 — contract pin for the WalletBackend interface.
import type { WalletBackend } from './WalletBackend';
import { isTerminalStatus } from './types';

const fake: WalletBackend = {
  kind: 'custodial-lnbits',
  capabilities: { onchain: false, lnSend: true, lnReceive: true },
  getBalance: async () => ({ lightningSat: 0 }),
  createInvoice: async () => ({ bolt11: 'lnbc1...' }),
  payInvoice: async () => ({ preimage: '00', feeSat: 0 }),
  payLnAddress: async () => ({ preimage: '00' }),
  listTransactions: async () => ({ txs: [] }),
};

describe('WalletBackend contract', () => {
  it('keeps all five required methods on the interface', () => {
    expect(typeof fake.getBalance).toBe('function');
    expect(typeof fake.createInvoice).toBe('function');
    expect(typeof fake.payInvoice).toBe('function');
    expect(typeof fake.payLnAddress).toBe('function');
    expect(typeof fake.listTransactions).toBe('function');
  });

  it('exposes capability flags', () => {
    expect(fake.capabilities.lnSend).toBe(true);
    expect(fake.capabilities.onchain).toBe(false);
  });

  it('marks terminal vs non-terminal payment status', () => {
    expect(isTerminalStatus('pending')).toBe(false);
    expect(isTerminalStatus('settled')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('expired')).toBe(true);
  });
});
