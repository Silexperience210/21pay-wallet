// sendAll custody-migration orchestration (D-06). Pure logic with both backends
// injected (a transient two-backend op): invoice on the NEW backend, paid from the
// OLD. Covers the Pitfall-4 edge cases.
//
// Run: `npx jest src/wallet/backends/migration.test.ts`
import type { WalletBackend } from '../WalletBackend';
import { sendAll, isSameNode, FEE_RESERVE_RATIO } from './migration';

function mockBackend(over: Partial<WalletBackend> & { lightningSat?: number } = {}): WalletBackend {
  const { lightningSat = 0, ...rest } = over;
  return {
    kind: 'custodial-lnbits',
    capabilities: { onchain: false, lnSend: true, lnReceive: true },
    getBalance: jest.fn(async () => ({ lightningSat })),
    createInvoice: jest.fn(async (amountSat: number) => ({
      bolt11: `lnbc-mig-${amountSat}`,
      paymentHash: 'h'.repeat(64),
    })),
    payInvoice: jest.fn(async () => ({ preimage: 'p', feeSat: 1, paymentHash: 'h'.repeat(64) })),
    payLnAddress: jest.fn(),
    listTransactions: jest.fn(async () => ({ txs: [] })),
    ...rest,
  } as unknown as WalletBackend;
}

describe('sendAll — guided custody migration (D-06)', () => {
  it('D-06: zero balance returns { moved: 0 } and skips the migration payment', async () => {
    const from = mockBackend({ lightningSat: 0 });
    const to = mockBackend();
    await expect(sendAll(from, to)).resolves.toEqual({ moved: 0 });
    expect(to.createInvoice).not.toHaveBeenCalled();
    expect(from.payInvoice).not.toHaveBeenCalled();
  });

  it('D-06: reserves a fee buffer (sendable = floor(balance × (1 − reserve))), never sends the full balance', async () => {
    const from = mockBackend({ lightningSat: 10_000 });
    const to = mockBackend();
    const r = await sendAll(from, to);
    const expected = Math.floor(10_000 * (1 - FEE_RESERVE_RATIO));
    expect(r.moved).toBe(expected);
    expect(r.moved).toBeLessThan(10_000);
    expect(to.createInvoice).toHaveBeenCalledWith(expected, expect.any(String));
  });

  it('D-06: throws when the reserved-sendable amount is <= 0 (balance too small to cover fees)', async () => {
    // floor(0.9) = 0 with the 1% reserve when balance is tiny — force it via ratio math:
    const from = mockBackend({ lightningSat: 0.5 as unknown as number });
    const to = mockBackend();
    await expect(sendAll(from, to)).rejects.toThrow(/too small to cover fees/);
    expect(from.payInvoice).not.toHaveBeenCalled();
  });

  it('D-06: throws when the destination backend lacks capabilities.lnReceive', async () => {
    const from = mockBackend({ lightningSat: 10_000 });
    const to = mockBackend({ capabilities: { onchain: false, lnSend: true, lnReceive: false } });
    await expect(sendAll(from, to)).rejects.toThrow(/destination cannot receive/);
    expect(from.getBalance).not.toHaveBeenCalled(); // gate fires before any IO
  });

  it('D-06: same-node pay-self is guarded by the caller before sendAll (isSameNode contract)', () => {
    const nwcA = mockBackend() as unknown as { cfg?: { walletPubkey?: string } };
    const nwcB = mockBackend() as unknown as { cfg?: { walletPubkey?: string } };
    nwcA.cfg = { walletPubkey: 'aa'.repeat(32) };
    nwcB.cfg = { walletPubkey: 'aa'.repeat(32) };
    expect(isSameNode(nwcA as unknown as WalletBackend, nwcB as unknown as WalletBackend)).toBe(true);
    nwcB.cfg = { walletPubkey: 'bb'.repeat(32) };
    expect(isSameNode(nwcA as unknown as WalletBackend, nwcB as unknown as WalletBackend)).toBe(false);
    // unknown pubkeys (custodial/spark) ⇒ false, the UI warns instead
    expect(isSameNode(mockBackend(), mockBackend())).toBe(false);
  });

  it('D-06: creates an invoice on the new backend for the sendable amount and pays it from the old', async () => {
    const from = mockBackend({ lightningSat: 50_000 });
    const to = mockBackend();
    const r = await sendAll(from, to);
    const sendable = Math.floor(50_000 * (1 - FEE_RESERVE_RATIO));
    expect(to.createInvoice).toHaveBeenCalledWith(sendable, expect.any(String));
    expect(from.payInvoice).toHaveBeenCalledWith(`lnbc-mig-${sendable}`);
    expect(r).toEqual({ moved: sendable });
  });

  it('D-06: reconciles the payment to a terminal state before declaring the move done', async () => {
    const reconcile = jest.fn(async () => 'settled' as const);
    const from = mockBackend({ lightningSat: 20_000, reconcile });
    const to = mockBackend();
    await sendAll(from, to);
    expect(reconcile).toHaveBeenCalledWith('h'.repeat(64), expect.anything(), undefined);
  });

  it('D-06: a terminal failed/expired reconcile throws (funds did not move)', async () => {
    const reconcile = jest.fn(async () => 'failed' as const);
    const from = mockBackend({ lightningSat: 20_000, reconcile });
    const to = mockBackend();
    await expect(sendAll(from, to)).rejects.toThrow(/funds did not move/);
  });
});
