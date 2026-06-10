// NwcRemote contract tests (ONBD-02, IDENT-03). The @getalby/sdk NWCClient is mocked
// (__mocks__/@getalby/sdk.ts) so no real relay socket opens; core/net is mocked so
// payLnAddress's LNURLp resolution does no network IO.
import * as fs from 'fs';
import * as path from 'path';
import { NwcRemote, type NwcConnectionConfig } from './nwcRemote';

jest.mock('@getalby/sdk');
jest.mock('../../core/net', () => ({ httpRequest: jest.fn() }));
import { httpRequest } from '../../core/net';

const CFG: NwcConnectionConfig = {
  id: 'conn-1',
  name: 'Alby',
  walletPubkey: 'a'.repeat(64),
  relayUrl: 'wss://relay.example',
  uri: `nostr+walletconnect://${'a'.repeat(64)}?relay=wss://relay.example&secret=${'b'.repeat(64)}`,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const clientOf = (b: NwcRemote): any => (b as any).client;

describe('NwcRemote — WalletBackend over @getalby/sdk (ONBD-02, IDENT-03)', () => {
  it('ONBD-02: getBalance maps balance (msats) -> lightningSat (floor / 1000)', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).getBalance.mockResolvedValueOnce({ balance: 12_345_678 });
    expect(await b.getBalance()).toEqual({ lightningSat: 12345 });
  });

  it('ONBD-02: createInvoice converts amountSat*1000 -> makeInvoice and returns { bolt11, paymentHash }', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).makeInvoice.mockResolvedValueOnce({ invoice: 'lnbcX', payment_hash: 'hashX' });
    const r = await b.createInvoice(1000, 'memo');
    expect(clientOf(b).makeInvoice).toHaveBeenCalledWith({ amount: 1_000_000, description: 'memo' });
    expect(r).toEqual({ bolt11: 'lnbcX', paymentHash: 'hashX' });
  });

  it('ONBD-02: payInvoice maps fees_paid (msats) -> feeSat and returns the preimage', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).payInvoice.mockResolvedValueOnce({ preimage: 'pre', fees_paid: 2_500 });
    const r = await b.payInvoice('lnbc...');
    expect(r.preimage).toBe('pre');
    expect(r.feeSat).toBe(2);
  });

  it('ONBD-02: payLnAddress resolves LNURLp -> invoice then payInvoice', async () => {
    const b = new NwcRemote(CFG);
    (httpRequest as jest.Mock)
      .mockResolvedValueOnce({ data: { callback: 'https://domain.com/lnurlp/cb' } })
      .mockResolvedValueOnce({ data: { pr: 'lnbcFromLnurl' } });
    clientOf(b).payInvoice.mockResolvedValueOnce({ preimage: 'preLnurl', fees_paid: 0 });
    const r = await b.payLnAddress('alice@domain.com', 500);
    expect(r.preimage).toBe('preLnurl');
    expect(clientOf(b).payInvoice).toHaveBeenCalledWith({ invoice: 'lnbcFromLnurl' });
  });

  it('ONBD-02: listTransactions maps NWC transactions -> WalletTx[] (msat->sat, direction, status)', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).listTransactions.mockResolvedValueOnce({
      transactions: [
        { payment_hash: 'h1', amount: 10_000, type: 'incoming', settled_at: 1_700_000_000, description: 'tip' },
        { payment_hash: 'h2', amount: 5_000, type: 'outgoing', settled_at: 1_700_000_100 },
      ],
    });
    const { txs } = await b.listTransactions();
    expect(txs[0]).toMatchObject({ id: 'h1', direction: 'in', amountSat: 10, status: 'settled', createdAt: 1_700_000_000_000, memo: 'tip' });
    expect(txs[1]).toMatchObject({ id: 'h2', direction: 'out', amountSat: 5 });
  });

  it('ONBD-02: reconcile maps settled_at -> settled via the state machine', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).lookupInvoice.mockResolvedValueOnce({ settled_at: 1_700_000_000, preimage: 'p' });
    expect(await b.reconcile('h', 'pending')).toBe('settled');
  });

  it('ONBD-02: reconcile leaves an unsettled invoice pending', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).lookupInvoice.mockResolvedValueOnce({ settled_at: null });
    expect(await b.reconcile('h', 'pending')).toBe('pending');
  });

  it('ONBD-02: capabilities = { onchain:false, lnSend:true, lnReceive:true } and kind=nwc', () => {
    const b = new NwcRemote(CFG);
    expect(b.capabilities).toEqual({ onchain: false, lnSend: true, lnReceive: true });
    expect(b.kind).toBe('nwc');
  });

  it('IDENT-03: when getInfo().methods includes get_budget -> read-only display via getBudget()', async () => {
    const b = new NwcRemote(CFG);
    await b.negotiate(); // default mock methods include get_budget
    clientOf(b).getBudget.mockResolvedValueOnce({ used_budget: 1_000, total_budget: 50_000, renews_at: 123 });
    const bud = await b.readBudget();
    expect(bud).toMatchObject({ usedSat: 1, totalSat: 50, renewsAt: 123 });
  });

  it('IDENT-03: when getInfo().methods lacks get_budget -> readBudget returns null (no claimed local cap)', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).getInfo.mockResolvedValueOnce({ methods: ['get_balance', 'make_invoice', 'pay_invoice'] });
    await b.negotiate();
    expect(await b.readBudget()).toBeNull();
  });

  it('IDENT-03 / D-03: a requested cap (connection minted with one) is passed through', async () => {
    const b = new NwcRemote({ ...CFG, requestedBudgetSat: 21_000 });
    await b.negotiate();
    const bud = await b.readBudget();
    expect(bud?.requestedSat).toBe(21_000);
  });

  it('ONBD-02: negotiate refuses to activate when pay_invoice is not supported', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).getInfo.mockResolvedValueOnce({ methods: ['get_balance', 'make_invoice'] });
    await expect(b.negotiate()).rejects.toThrow(/spending backend/);
  });

  it('ONBD-02: degrades listTransactions to empty when list_transactions is absent', async () => {
    const b = new NwcRemote(CFG);
    clientOf(b).getInfo.mockResolvedValueOnce({ methods: ['get_balance', 'make_invoice', 'pay_invoice'] });
    await b.negotiate();
    expect(await b.listTransactions()).toEqual({ txs: [] });
    expect(clientOf(b).listTransactions).not.toHaveBeenCalled();
  });

  it("IDENT-03: nwcRemote.ts secret comes from the URI, never from core/keys derivation", () => {
    const src = fs.readFileSync(path.join(__dirname, 'nwcRemote.ts'), 'utf8');
    expect(src).toContain('nostrWalletConnectUrl: cfg.uri'); // secret sourced from the URI (D-04)
    expect(src).not.toMatch(/derivation/); // no identity-key import (IDENT-03 / CLAUDE.md #2)
    expect(src).not.toMatch(/1237/); // no NIP-06 identity path
  });

  it('ONBD-02: close() disposes the NWCClient socket (Pitfall 1)', () => {
    const b = new NwcRemote(CFG);
    b.close();
    expect(clientOf(b).close).toHaveBeenCalled();
  });
});
