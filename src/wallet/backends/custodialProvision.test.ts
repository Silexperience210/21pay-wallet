// Req ONBD-01 — provisioning logic against a mocked LNbits API (no live server).
import { createCustodialAccount } from './custodialProvision';

beforeEach(() => {
  process.env.EXPO_PUBLIC_LNBITS_URL = 'https://lnbits.test';
});

function mockFetch(res: { ok: boolean; status: number; body: unknown }) {
  (global as { fetch?: unknown }).fetch = jest.fn(async () => ({
    ok: res.ok,
    status: res.status,
    json: async () => res.body,
  }));
}

describe('createCustodialAccount', () => {
  it('returns the NEW wallet keys (not the provisioning key) + base URL from env', async () => {
    mockFetch({
      ok: true,
      status: 200,
      body: { id: 'u1', wallets: [{ id: 'w1', adminkey: 'NEW-ADMIN', inkey: 'NEW-IN' }] },
    });
    const cfg = await createCustodialAccount('PROVISION-KEY');
    expect(cfg.adminKey).toBe('NEW-ADMIN');
    expect(cfg.invoiceKey).toBe('NEW-IN');
    expect(cfg.adminKey).not.toBe('PROVISION-KEY');
    expect(cfg.baseUrl).toBe('https://lnbits.test');
  });

  it('throws on a 401 without leaking the provisioning admin key', async () => {
    mockFetch({ ok: false, status: 401, body: {} });
    let msg = '';
    try {
      await createCustodialAccount('PROVISION-KEY-SUPER-SECRET');
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).not.toContain('PROVISION-KEY-SUPER-SECRET');
  });
});
