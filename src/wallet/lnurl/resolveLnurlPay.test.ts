import { bech32 } from '@scure/base';
import { resolveLnurlPay, lnurlToUrl } from './resolveLnurlPay';

describe('lnurlToUrl', () => {
  it('round-trips a bech32-encoded URL', () => {
    const url = 'https://pay.21.org/lnurlp/abc?x=1';
    const words = bech32.toWords(new TextEncoder().encode(url));
    const lnurl = bech32.encode('lnurl', words, 2000);
    expect(lnurlToUrl(lnurl)).toBe(url);
  });
});

describe('resolveLnurlPay', () => {
  it('resolves a Lightning Address to well-known + msat→sat bounds', async () => {
    const request = jest.fn().mockResolvedValue({
      status: 200,
      data: { callback: 'https://ln.org/cb', minSendable: 1000, maxSendable: 100_000 },
    });
    const out = await resolveLnurlPay('alice@ln.org', request as never);
    expect(out).toEqual({ callback: 'https://ln.org/cb', minSat: 1, maxSat: 100, domain: 'ln.org' });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://ln.org', path: '/.well-known/lnurlp/alice' }),
    );
  });

  it('resolves a bech32 lnurl1 to its embedded URL', async () => {
    const url = 'https://svc.org/lnurlp/bob';
    const lnurl = bech32.encode('lnurl', bech32.toWords(new TextEncoder().encode(url)), 2000);
    const request = jest.fn().mockResolvedValue({
      status: 200,
      data: { callback: 'https://svc.org/cb', minSendable: 5000, maxSendable: 5000 },
    });
    const out = await resolveLnurlPay(lnurl, request as never);
    expect(out.domain).toBe('svc.org');
    expect(out.minSat).toBe(5);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://svc.org', path: '/lnurlp/bob' }),
    );
  });

  it('rejects malformed input and a non-pay response', async () => {
    await expect(resolveLnurlPay('not-an-lnurl', jest.fn() as never)).rejects.toThrow();
    const noCallback = jest.fn().mockResolvedValue({ status: 200, data: {} });
    await expect(resolveLnurlPay('a@b.com', noCallback as never)).rejects.toThrow();
  });
});
