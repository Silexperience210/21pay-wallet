// Req WALLET-09 (transport reliability) — mocked fetch, no live server.
import { httpRequest, backoffDelayMs } from './http';
import { HttpError } from './types';

function mockSequence(responses: Array<{ ok: boolean; status: number; body?: unknown } | 'throw'>) {
  let i = 0;
  (global as { fetch?: unknown }).fetch = jest.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (r === 'throw') throw new Error('network down');
    return { ok: r.ok, status: r.status, json: async () => r.body ?? {} };
  });
  return () => i;
}

describe('httpRequest', () => {
  it('returns parsed data on 2xx', async () => {
    mockSequence([{ ok: true, status: 200, body: { hello: 'world' } }]);
    const res = await httpRequest<{ hello: string }>({ baseUrl: 'https://x', path: '/p' });
    expect(res.status).toBe(200);
    expect(res.data.hello).toBe('world');
  });

  it('retries an idempotent GET on 500 then succeeds', async () => {
    const calls = mockSequence([
      { ok: false, status: 500 },
      { ok: false, status: 500 },
      { ok: true, status: 200, body: { ok: 1 } },
    ]);
    const res = await httpRequest({ baseUrl: 'https://x', path: '/p', idempotent: true, retries: 3 });
    expect(res.status).toBe(200);
    expect(calls()).toBe(3);
  });

  it('does NOT retry a 4xx (client error)', async () => {
    const calls = mockSequence([{ ok: false, status: 400 }]);
    await expect(
      httpRequest({ baseUrl: 'https://x', path: '/p', idempotent: true }),
    ).rejects.toMatchObject({ code: 'client', status: 400 });
    expect(calls()).toBe(1);
  });

  it('does NOT auto-retry a mutation (idempotent:false)', async () => {
    const calls = mockSequence([{ ok: false, status: 500 }]);
    await expect(
      httpRequest({ baseUrl: 'https://x', path: '/pay', method: 'POST', idempotent: false }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(calls()).toBe(1);
  });

  it('never leaks the bearer token into the error message', async () => {
    mockSequence(['throw']);
    const token = 'super-secret-admin-key-abc123';
    let msg = '';
    try {
      await httpRequest({ baseUrl: 'https://x', path: '/p', bearerToken: token, apiKey: token });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).not.toContain(token);
  });

  it('backoffDelayMs grows with attempt and caps at 5s+jitter', () => {
    expect(backoffDelayMs(0)).toBeGreaterThanOrEqual(200);
    expect(backoffDelayMs(1)).toBeGreaterThanOrEqual(400);
    expect(backoffDelayMs(10)).toBeLessThanOrEqual(5100);
  });
});
