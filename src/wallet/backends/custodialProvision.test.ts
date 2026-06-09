// Req ONBD-01 — provisioning via LNbits v1 core POST /api/v1/account (mocked fetch).
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

describe('createCustodialAccount (LNbits v1 /api/v1/account)', () => {
  it('returns the NEW wallet keys + base URL from env', async () => {
    mockFetch({
      ok: true,
      status: 200,
      body: { id: 'w1', user: 'u1', adminkey: 'NEW-ADMIN', inkey: 'NEW-IN', name: '21pay-x' },
    });
    const cfg = await createCustodialAccount();
    expect(cfg.adminKey).toBe('NEW-ADMIN');
    expect(cfg.invoiceKey).toBe('NEW-IN');
    expect(cfg.readKey).toBe('NEW-IN');
    expect(cfg.baseUrl).toBe('https://lnbits.test');
  });

  it('throws if LNbits returns no wallet keys', async () => {
    mockFetch({ ok: true, status: 200, body: { id: 'w1', user: 'u1', name: 'x' } });
    await expect(createCustodialAccount()).rejects.toThrow();
  });
});
