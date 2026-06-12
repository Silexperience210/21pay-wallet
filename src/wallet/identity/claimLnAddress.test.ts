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
  it('returns the formatted address on success', async () => {
    const request = jest.fn().mockResolvedValue({ status: 201, data: { id: 'link1' } });
    const { lnAddress } = await claimLnAddress('alice', cfg, request as never);
    expect(lnAddress).toBe(`alice@${LN_ADDRESS_DOMAIN}`);
  });

  it('rejects an invalid handle before any network call', async () => {
    const request = jest.fn();
    await expect(claimLnAddress('Admin', cfg, request as never)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it('never leaks the API key to the console', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
    ];
    const request = jest.fn().mockResolvedValue({ status: 201, data: { id: 'link1' } });
    await claimLnAddress('alice', cfg, request as never);
    for (const s of spies) {
      for (const call of s.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(cfg.invoiceKey);
      }
      s.mockRestore();
    }
  });
});
