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
