// Resolve an LNURL-pay endpoint (bech32 lnurl1… or a name@domain Lightning Address)
// to its callback + min/max sendable bounds, so the Send UI can enforce them BEFORE
// paying. The actual payment still goes through the backend (payLnAddress). Pure-ish:
// the only IO is the well-known GET, which is injectable for tests.
import { bech32 } from '@scure/base';
import { httpRequest } from '../../core/net';

export interface LnurlPayParams {
  callback: string;
  minSat: number;
  maxSat: number;
  domain: string;
}

type RequestFn = typeof httpRequest;

/** Decode a bech32 `lnurl1…` string into its embedded https URL. */
export function lnurlToUrl(lnurl: string): string {
  // LNURLs exceed bech32's default 90-char limit — pass a generous cap.
  const { words } = bech32.decode(lnurl.toLowerCase() as `${string}1${string}`, 2000);
  const bytes = bech32.fromWords(words);
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

function splitUrl(url: string): { baseUrl: string; path: string } {
  const u = new URL(url);
  return { baseUrl: u.origin, path: `${u.pathname}${u.search}` };
}

/**
 * Resolve `input` (an lnurl1… or name@domain) to LNURL-pay params. Throws on a
 * malformed input or a non-pay response. minSendable/maxSendable are msat → sat.
 */
export async function resolveLnurlPay(
  input: string,
  request: RequestFn = httpRequest,
): Promise<LnurlPayParams> {
  const s = input.trim().replace(/^lightning:/i, '');
  let url: string;
  let domain: string;

  if (s.toLowerCase().startsWith('lnurl1')) {
    url = lnurlToUrl(s);
    domain = new URL(url).hostname;
  } else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) {
    const [name, d] = s.split('@');
    url = `https://${d}/.well-known/lnurlp/${encodeURIComponent(name)}`;
    domain = d;
  } else {
    throw new Error('Not an LNURL-pay or Lightning address.');
  }

  const { baseUrl, path } = splitUrl(url);
  const res = await request<{
    callback?: string;
    minSendable?: number;
    maxSendable?: number;
    tag?: string;
  }>({ baseUrl, path, method: 'GET', idempotent: true });

  if (!res.data.callback) throw new Error('Invalid LNURL-pay response.');
  return {
    callback: res.data.callback,
    minSat: Math.ceil((res.data.minSendable ?? 1000) / 1000),
    maxSat: Math.floor((res.data.maxSendable ?? 0) / 1000),
    domain,
  };
}
