import { checkLnAddressAvailable, claimLnAddress } from './claimLnAddress';
import { LN_ADDRESS_DOMAIN } from './lnAddressHandle';
import { HttpError } from '../../core/net';
import type { CustodialLnbitsConfig } from '../lnbitsConfig';

const cfg: CustodialLnbitsConfig = {
  baseUrl: 'https://lnbits.test',
  adminKey: 'ADMIN_SECRET',
  invoiceKey: 'INVOICE_SECRET',
  readKey: 'READ_SECRET',
};

describe('checkLnAddressAvailable', () => {
  it('returns false for an invalid handle WITHOUT a network call', async () => {
    const request = jest.fn();
    expect(await checkLnAddressAvailable('Bad Name', cfg, request as never)).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('returns true when the well-known probe 404s (legacy free)', async () => {
    const request = jest.fn().mockRejectedValue(new HttpError(404, 'client', 'request failed (404)'));
    expect(await checkLnAddressAvailable('alice', cfg, request as never)).toBe(true);
  });

  it('returns true on the LNbits v1 LNURL error envelope (HTTP 200 + status:ERROR = free)', async () => {
    // Live payload captured 2026-06-12 on 21pay.org for an unknown name.
    const request = jest.fn().mockResolvedValue({
      status: 200,
      data: { status: 'ERROR', reason: 'Lightning address not found.' },
    });
    expect(await checkLnAddressAvailable('alice', cfg, request as never)).toBe(true);
  });

  it('returns false when the probe resolves a REAL LNURLp payload (taken)', async () => {
    const request = jest.fn().mockResolvedValue({
      status: 200,
      data: { tag: 'payRequest', callback: 'https://21pay.org/lnurlp/api/v1/lnurl/cb/x', minSendable: 1000 },
    });
    expect(await checkLnAddressAvailable('alice', cfg, request as never)).toBe(false);
  });

  it('degrades to false on a network error', async () => {
    const request = jest.fn().mockRejectedValue(new HttpError(0, 'network', 'network error'));
    expect(await checkLnAddressAvailable('alice', cfg, request as never)).toBe(false);
  });
});

describe('claimLnAddress', () => {
  it('creates the link with the ADMIN key and disposable:false (verified live)', async () => {
    // Regression guard: the invoice key returns 403 "Invalid adminkey." on real LNbits,
    // and an omitted `disposable` makes a single-use link.
    const request = jest.fn().mockResolvedValue({ status: 201, data: { id: 'link1' } });
    const { lnAddress } = await claimLnAddress('alice', cfg, request as never);
    expect(lnAddress).toBe(`alice@${LN_ADDRESS_DOMAIN}`);
    const arg = request.mock.calls[0][0];
    expect(arg).toMatchObject({
      path: '/lnurlp/api/v1/links',
      method: 'POST',
      apiKey: cfg.adminKey,
    });
    expect(arg.apiKey).not.toBe(cfg.invoiceKey);
    expect(arg.body).toMatchObject({ username: 'alice', disposable: false });
  });

  it('rejects an invalid handle before any network call', async () => {
    const request = jest.fn();
    await expect(claimLnAddress('Admin', cfg, request as never)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it('enables the lnurlp extension and retries once on a 403 (when userId is known)', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(new HttpError(403, 'client', 'request failed (403)'))
      .mockResolvedValueOnce({ status: 201, data: { id: 'link1' } });
    const enable = jest.fn().mockResolvedValue(undefined);
    const cfgWithUser = { ...cfg, userId: 'user-123' };
    const { lnAddress } = await claimLnAddress('alice', cfgWithUser, request as never, enable);
    expect(lnAddress).toBe(`alice@${LN_ADDRESS_DOMAIN}`);
    expect(enable).toHaveBeenCalledWith('user-123');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('propagates a 403 when no userId is known (cannot self-heal)', async () => {
    const request = jest.fn().mockRejectedValue(new HttpError(403, 'client', 'request failed (403)'));
    const enable = jest.fn();
    await expect(claimLnAddress('alice', cfg, request as never, enable)).rejects.toThrow();
    expect(enable).not.toHaveBeenCalled();
  });

  it('never leaks an API key to the console', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
    ];
    const request = jest.fn().mockResolvedValue({ status: 201, data: { id: 'link1' } });
    await claimLnAddress('alice', cfg, request as never);
    for (const s of spies) {
      for (const call of s.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(cfg.adminKey);
        expect(JSON.stringify(call)).not.toContain(cfg.invoiceKey);
      }
      s.mockRestore();
    }
  });
});
