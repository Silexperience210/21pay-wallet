// Req WALLET-09, ONBD-01 — CustodialLNbits over LNbits REST, mocked fetch (no live server).
import { CustodialLnbits } from './custodialLnbits';
import * as net from '../../core/net';

const cfg = {
  baseUrl: 'https://lnbits.test',
  adminKey: 'ADMIN-KEY-supersecret-xyz',
  invoiceKey: 'INVOICE-KEY',
  readKey: 'READ-KEY',
};

let lastInit: { headers?: Record<string, string>; body?: string } = {};

function mockFetch(handler: () => { ok: boolean; status: number; body: unknown }) {
  const fn = jest.fn(async (_url: string, init: { headers?: Record<string, string>; body?: string }) => {
    lastInit = init ?? {};
    const r = handler();
    return { ok: r.ok, status: r.status, json: async () => r.body };
  });
  (global as { fetch?: unknown }).fetch = fn;
  return fn;
}

beforeEach(() => net.__resetQueueForTests());

describe('CustodialLnbits', () => {
  it('createInvoice posts out:false and returns the bolt11', async () => {
    mockFetch(() => ({ ok: true, status: 200, body: { payment_hash: 'h1', payment_request: 'lnbc1xxx' } }));
    const r = await new CustodialLnbits(cfg).createInvoice(1000, 'gm');
    expect(r.bolt11).toBe('lnbc1xxx');
    expect(JSON.parse(lastInit.body ?? '{}').out).toBe(false);
  });

  it('payInvoice sends the admin key header and returns preimage/fee', async () => {
    mockFetch(() => ({ ok: true, status: 200, body: { payment_hash: 'h', preimage: 'pre', fee: 1000 } }));
    const r = await new CustodialLnbits(cfg).payInvoice('lnbcPAY1');
    expect(r.preimage).toBe('pre');
    expect(r.feeSat).toBe(1);
    expect(lastInit.headers?.['X-Api-Key']).toBe(cfg.adminKey);
  });

  it('dedupes a repeated payInvoice — exactly one fetch (no double-spend)', async () => {
    const f = mockFetch(() => ({ ok: true, status: 200, body: { preimage: 'pre', fee: 0 } }));
    const b = new CustodialLnbits(cfg);
    await b.payInvoice('lnbcSAME');
    await expect(b.payInvoice('lnbcSAME')).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('getBalance converts millisat → sat', async () => {
    mockFetch(() => ({ ok: true, status: 200, body: { balance: 21000 } }));
    expect((await new CustodialLnbits(cfg).getBalance()).lightningSat).toBe(21);
  });

  it('reconcile: paid → settled; unpaid + past expiry → expired', async () => {
    mockFetch(() => ({ ok: true, status: 200, body: { paid: true } }));
    expect(await new CustodialLnbits(cfg).reconcile('h')).toBe('settled');
    mockFetch(() => ({ ok: true, status: 200, body: { paid: false } }));
    expect(await new CustodialLnbits(cfg).reconcile('h', 'pending', Date.now() - 1000)).toBe('expired');
  });

  // LNbits v1 schema (verified live vs 21pay.org 2026-06-11): `status` is a string
  // ('success'|'pending'|'failed') — the legacy boolean `pending` is GONE; `time` is
  // an ISO datetime string. The old mapping displayed UNPAID invoices as "Settled"
  // with 01/01/1970 dates (the balance/history mismatch bug).
  it('listTransactions maps the LNbits v1 schema: status string + ISO time', async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      body: [
        {
          payment_hash: 'h-pending',
          amount: 1000, // +1 sat incoming, UNPAID
          status: 'pending',
          time: '2026-06-11T10:07:08.315253+00:00',
          created_at: '2026-06-11T10:07:08.315257+00:00',
          memo: 'unpaid invoice',
        },
        {
          payment_hash: 'h-paid',
          amount: 2000,
          status: 'success',
          time: '2026-06-11T09:00:00+00:00',
          memo: 'real receive',
        },
        {
          payment_hash: 'h-failed',
          amount: -3000,
          status: 'failed',
          time: '2026-06-11T08:00:00+00:00',
        },
      ],
    }));
    const { txs } = await new CustodialLnbits(cfg).listTransactions();
    // An unpaid invoice is PENDING — never shown as settled (the screenshot bug).
    expect(txs[0]).toMatchObject({ id: 'h-pending', status: 'pending', amountSat: 1, direction: 'in' });
    expect(txs[1]).toMatchObject({ id: 'h-paid', status: 'settled', amountSat: 2 });
    expect(txs[2]).toMatchObject({ id: 'h-failed', status: 'failed', direction: 'out' });
    // ISO time parses to real ms — never the 01/01/1970 epoch.
    expect(txs[0].createdAt).toBe(Date.parse('2026-06-11T10:07:08.315253+00:00'));
    expect(txs[0].createdAt).toBeGreaterThan(1_700_000_000_000);
  });

  it('listTransactions still maps the legacy (<v1) schema: pending bool + unix time', async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      body: [
        { payment_hash: 'h1', amount: 5000, pending: true, time: 1718000000, memo: 'old pending' },
        { payment_hash: 'h2', amount: 5000, pending: false, time: 1718000001 },
      ],
    }));
    const { txs } = await new CustodialLnbits(cfg).listTransactions();
    expect(txs[0]).toMatchObject({ status: 'pending', createdAt: 1718000000 * 1000 });
    expect(txs[1]).toMatchObject({ status: 'settled' });
  });

  it('never leaks the admin key in an error message', async () => {
    mockFetch(() => {
      throw new Error('boom');
    });
    let msg = '';
    try {
      await new CustodialLnbits(cfg).getBalance();
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).not.toContain(cfg.adminKey);
  });
});
