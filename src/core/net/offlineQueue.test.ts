// Req WALLET-09 (replay safety) — mocked fetch, no live server.
import { enqueue, drain, serialize, hydrate, __resetQueueForTests } from './offlineQueue';
import type { HttpRequestOptions } from './types';

const req = (path: string): HttpRequestOptions => ({ baseUrl: 'https://x', path, method: 'POST' });

function mockFetch(behavior: 'ok' | 'fail') {
  (global as { fetch?: unknown }).fetch = jest.fn(async () => {
    if (behavior === 'fail') throw new Error('network down');
    return { ok: true, status: 200, json: async () => ({}) };
  });
  return (global as unknown as { fetch: jest.Mock }).fetch;
}

beforeEach(() => __resetQueueForTests());

describe('offlineQueue', () => {
  it('enqueues then drains, calling fetch once and acking', async () => {
    const f = mockFetch('ok');
    expect(enqueue({ dedupeKey: 'a', request: req('/pay') })).toBe(true);
    const r = await drain();
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.processed).toBe(1);
    expect(r.remaining).toBe(0);
  });

  it('dedupes a repeated key — sends exactly one request (no double-spend)', async () => {
    const f = mockFetch('ok');
    expect(enqueue({ dedupeKey: 'pay-hash-1', request: req('/pay') })).toBe(true);
    expect(enqueue({ dedupeKey: 'pay-hash-1', request: req('/pay') })).toBe(false);
    await drain();
    expect(f).toHaveBeenCalledTimes(1);
    // already acked → re-enqueue still a no-op
    expect(enqueue({ dedupeKey: 'pay-hash-1', request: req('/pay') })).toBe(false);
  });

  it('stops at the first failure and keeps items pending in order', async () => {
    mockFetch('fail');
    enqueue({ dedupeKey: 'a', request: req('/1') });
    enqueue({ dedupeKey: 'b', request: req('/2') });
    const r = await drain();
    expect(r.processed).toBe(0);
    expect(r.remaining).toBe(2);
  });

  it('serialize → hydrate round-trips pending state', async () => {
    mockFetch('ok');
    enqueue({ dedupeKey: 'a', request: req('/1') });
    const snap = serialize();
    __resetQueueForTests();
    hydrate(snap);
    const r = await drain();
    expect(r.processed).toBe(1);
  });
});
