// Confirmed BitRent HTTP contract via mocked httpRequest (MINE-01/02/03) — same
// discipline as casinoApi.test.ts. The JWT is auth material: injected ONLY into
// request headers, never in a return value.
//
// Run: `npx jest src/sections/miners/bitrentApi.test.ts`
jest.mock('../../core/net', () => ({ httpRequest: jest.fn() }));

import { httpRequest } from '../../core/net';
import type { SectionCapabilities } from '../capabilities';
import {
  loginWithNostr,
  getMiners,
  createRental,
  listRentals,
  getRentalStatus,
  getLiveStats,
  pollRentalUntilActive,
  setAuthToken,
  clearAuth,
  hasAuth,
} from './bitrentApi';
import { BITRENT_ORIGIN, isValidPayoutAddress, isValidDuration } from './bitrentConfig';

const mockHttp = httpRequest as jest.Mock;
const lastCall = () => mockHttp.mock.calls[mockHttp.mock.calls.length - 1][0];

const PUBKEY = 'e'.repeat(64);
const CHALLENGE = 'c'.repeat(64);
const TOKEN = 'jwt-abc';
const PAYOUT = 'bc1qgc34rs70pfekumxcxz7pztgjw3m8dx0ltlcvkw';

function mockCaps(): SectionCapabilities {
  return {
    wallet: {
      payInvoice: jest.fn(),
      payLnAddress: jest.fn(),
      createInvoice: jest.fn(),
    },
    signer: {
      signLnurlAuth: jest.fn(),
      getNostrPubkey: jest.fn(async () => PUBKEY),
      signNip98: jest.fn(async (opts: { url: string; method: string; challenge: string }) => ({
        id: 'i',
        pubkey: PUBKEY,
        created_at: 1,
        kind: 27235,
        tags: [
          ['u', opts.url],
          ['method', opts.method],
        ],
        content: opts.challenge,
        sig: 's',
      })),
    },
  } as unknown as SectionCapabilities;
}

beforeEach(() => {
  mockHttp.mockReset().mockResolvedValue({ status: 200, data: {} });
  clearAuth();
});

describe('bitrentConfig — server-exact validation', () => {
  it('accepts the real owner bech32 address and rejects garbage', () => {
    expect(isValidPayoutAddress(PAYOUT)).toBe(true);
    expect(isValidPayoutAddress('lnbc1notanaddress')).toBe(false);
    expect(isValidPayoutAddress('')).toBe(false);
  });
  it('duration bounds are 1..1440 integers', () => {
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(1440)).toBe(true);
    expect(isValidDuration(0)).toBe(false);
    expect(isValidDuration(1441)).toBe(false);
    expect(isValidDuration(2.5)).toBe(false);
  });
});

describe('bitrentApi — Nostr challenge-response login (D-02)', () => {
  it('challenge → NIP-98 sign via the seam → verify → token stored module-side', async () => {
    mockHttp
      .mockResolvedValueOnce({ status: 200, data: { challenge: CHALLENGE } })
      .mockResolvedValueOnce({ status: 200, data: { token: TOKEN, user: { id: 'u' } } });
    const caps = mockCaps();
    await expect(loginWithNostr(caps)).resolves.toBe(true);
    expect(hasAuth()).toBe(true);
    // challenge request carries the PUBLIC pubkey
    expect(mockHttp.mock.calls[0][0]).toMatchObject({
      path: '/api/auth/challenge',
      method: 'POST',
      body: { pubkey: PUBKEY },
      idempotent: false,
    });
    // the signed event posted to verify carries the challenge + verify URL
    const verifyCall = mockHttp.mock.calls[1][0];
    expect(verifyCall.path).toBe('/api/auth/verify');
    expect(verifyCall.body.event.content).toBe(CHALLENGE);
    expect(verifyCall.body.event.tags).toContainEqual(['u', `${BITRENT_ORIGIN}/api/auth/verify`]);
  });

  it('fails closed on a malformed challenge', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: { challenge: 'short' } });
    await expect(loginWithNostr(mockCaps())).resolves.toBe(false);
    expect(hasAuth()).toBe(false);
  });

  it('fails closed when verify returns no token', async () => {
    mockHttp
      .mockResolvedValueOnce({ status: 200, data: { challenge: CHALLENGE } })
      .mockResolvedValueOnce({ status: 200, data: { error: 'Invalid Nostr signature' } });
    await expect(loginWithNostr(mockCaps())).resolves.toBe(false);
  });
});

describe('bitrentApi — confirmed contract', () => {
  it('getMiners() GET /api/miners (idempotent, public)', async () => {
    mockHttp.mockResolvedValueOnce({
      status: 200,
      data: { miners: [{ id: 'm1', name: 'Hex', sats_per_minute: 2, available: true }] },
    });
    const miners = await getMiners();
    expect(lastCall()).toMatchObject({ baseUrl: BITRENT_ORIGIN, path: '/api/miners', idempotent: true });
    expect(miners[0].name).toBe('Hex');
  });

  it('createRental posts the EXACT server body shape and never blind-retries', async () => {
    setAuthToken(TOKEN);
    mockHttp.mockResolvedValueOnce({
      status: 201,
      data: { rental_id: 'r1', invoice: 'lnbc1rent', payment_hash: 'h', amount_sats: 120, expires_at: 'iso' },
    });
    const q = await createRental({
      minerId: 'm1',
      durationMinutes: 60,
      poolId: 'ocean',
      payoutAddress: PAYOUT,
    });
    expect(lastCall()).toMatchObject({
      path: '/api/rentals/create',
      method: 'POST',
      body: { miner_id: 'm1', duration_minutes: 60, pool_id: 'ocean', payout_address: PAYOUT },
      headers: { Authorization: `Bearer ${TOKEN}` },
      idempotent: false,
    });
    expect(q.invoice).toBe('lnbc1rent');
  });

  it('createRental validates bounds + payout BEFORE any request', async () => {
    await expect(
      createRental({ minerId: 'm', durationMinutes: 0, poolId: 'ocean', payoutAddress: PAYOUT }),
    ).rejects.toThrow(/bounds/);
    await expect(
      createRental({ minerId: 'm', durationMinutes: 60, poolId: 'ocean', payoutAddress: 'nope' }),
    ).rejects.toThrow(/payout/);
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it('listRentals / getRentalStatus / getLiveStats hit the confirmed paths with Bearer', async () => {
    setAuthToken(TOKEN);
    mockHttp.mockResolvedValue({ status: 200, data: { rentals: [] } });
    await listRentals();
    expect(lastCall()).toMatchObject({ path: '/api/rentals/list', idempotent: true });
    await getRentalStatus('r1');
    expect(lastCall()).toMatchObject({ path: '/api/rentals/status?id=r1' });
    await getLiveStats('r1');
    expect(lastCall()).toMatchObject({ path: '/api/rentals/status?id=r1&live=1' });
    expect(lastCall().headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });

  it('getLiveStats returns null on a 502 (miner unreachable) instead of throwing (D-07)', async () => {
    mockHttp.mockRejectedValueOnce(new Error('502'));
    await expect(getLiveStats('r1')).resolves.toBeNull();
  });

  it('pollRentalUntilActive polls status (the server-side activation trigger) to active', async () => {
    mockHttp
      .mockResolvedValueOnce({ status: 200, data: { status: 'pending' } })
      .mockResolvedValueOnce({ status: 200, data: { status: 'active' } });
    const out = await pollRentalUntilActive('r1', { sleep: async () => {} });
    expect(out).toBe('active');
    expect(mockHttp).toHaveBeenCalledTimes(2);
  });

  it('the JWT never appears in any function return value', async () => {
    setAuthToken(TOKEN);
    mockHttp.mockResolvedValue({ status: 200, data: { miners: [], rentals: [] } });
    for (const result of [await getMiners(), await listRentals()]) {
      expect(JSON.stringify(result)).not.toContain(TOKEN);
    }
    expect(hasAuth()).toBe(true);
  });
});
