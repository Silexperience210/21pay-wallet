// WALLET-08 provisioning client for name@21pay Lightning Addresses via the LNbits
// LNURLp extension. The handle is validated (plan 01) before any network call.
// API keys are passed via cfg and NEVER logged or placed in error messages.
import { httpRequest, HttpError } from '../../core/net';
import type { CustodialLnbitsConfig } from '../lnbitsConfig';
import { validateLnAddressHandle, LN_ADDRESS_DOMAIN } from './lnAddressHandle';

// Injectable for tests; defaults to the real client.
type RequestFn = typeof httpRequest;

/**
 * Is `name@LN_ADDRESS_DOMAIN` claimable? Validates the handle first (invalid → false
 * with NO network call), then probes /.well-known/lnurlp/{name}.
 *
 * LNbits v1 QUIRK (verified live 2026-06-12): an unknown address answers HTTP 200
 * with the LNURL error envelope `{"status":"ERROR","reason":"Lightning address not
 * found."}` — NOT a 404. So "200" alone does not mean taken: a real LNURLp payload
 * (callback/tag fields, no ERROR status) means taken; the ERROR envelope (or a
 * legacy 404) means free. Never throws — network errors degrade to false.
 */
export async function checkLnAddressAvailable(
  name: string,
  cfg: Pick<CustodialLnbitsConfig, 'baseUrl'>,
  request: RequestFn = httpRequest,
): Promise<boolean> {
  if (!validateLnAddressHandle(name).valid) return false;
  try {
    const res = await request<{ status?: string; callback?: string; tag?: string }>({
      baseUrl: cfg.baseUrl,
      path: `/.well-known/lnurlp/${encodeURIComponent(name)}`,
      method: 'GET',
      idempotent: true,
    });
    if (res.data?.status === 'ERROR') return true; // LNURL error envelope → free
    return false; // real LNURLp payload → already taken
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return true; // legacy 404 → free
    return false; // network/server error → not claimable
  }
}

/**
 * Claim `name@21pay` by creating an LNbits LNURLp pay link bound to username=name.
 * Validates the handle; throws on an invalid handle. Returns the formatted address.
 */
export async function claimLnAddress(
  name: string,
  cfg: CustodialLnbitsConfig,
  request: RequestFn = httpRequest,
): Promise<{ lnAddress: string }> {
  const v = validateLnAddressHandle(name);
  if (!v.valid) throw new Error(v.reason ?? 'Invalid handle.');

  await request<{ id: string }>({
    baseUrl: cfg.baseUrl,
    path: '/lnurlp/api/v1/links',
    method: 'POST',
    apiKey: cfg.invoiceKey, // never logged (HttpError messages omit the key)
    body: {
      description: `${name}@${LN_ADDRESS_DOMAIN}`,
      username: name,
      min: 1,
      max: 100_000_000,
      comment_chars: 0,
    },
  });

  return { lnAddress: `${name}@${LN_ADDRESS_DOMAIN}` };
}
