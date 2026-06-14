// WALLET-08 provisioning client for name@21pay Lightning Addresses via the LNbits
// LNURLp extension. The handle is validated (plan 01) before any network call.
// API keys are passed via cfg and NEVER logged or placed in error messages.
import { httpRequest, HttpError } from '../../core/net';
import type { CustodialLnbitsConfig } from '../lnbitsConfig';
import { enableFreeExtensions } from '../lnbitsExtensions';
import { validateLnAddressHandle, LN_ADDRESS_DOMAIN } from './lnAddressHandle';

// Injectable for tests; defaults to the real client.
type RequestFn = typeof httpRequest;
type EnableFn = (userId: string) => Promise<void>;

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
 *
 * Verified live against 21pay.org (2026-06-14): `POST /lnurlp/api/v1/links` requires
 * the ADMIN key — the invoice key returns 403 "Invalid adminkey." And the link must be
 * `disposable: false` or LNbits creates a single-use link (defaults to disposable).
 * If the wallet's lnurlp extension isn't enabled yet it 403s; we enable it (login-by-usr)
 * once and retry, so accounts created before auto-enable can still claim.
 */
export async function claimLnAddress(
  name: string,
  cfg: CustodialLnbitsConfig,
  request: RequestFn = httpRequest,
  enable: EnableFn = enableFreeExtensions,
): Promise<{ lnAddress: string }> {
  const v = validateLnAddressHandle(name);
  if (!v.valid) throw new Error(v.reason ?? 'Invalid handle.');

  const create = () =>
    request<{ id: string }>({
      baseUrl: cfg.baseUrl,
      path: '/lnurlp/api/v1/links',
      method: 'POST',
      apiKey: cfg.adminKey, // ADMIN key required by lnurlp (invoice key → 403); never logged
      body: {
        description: `${name}@${LN_ADDRESS_DOMAIN}`,
        username: name,
        min: 1,
        max: 100_000_000,
        comment_chars: 0,
        disposable: false, // permanent, reusable address (not a single-use link)
      },
    });

  try {
    await create();
  } catch (e) {
    // 403 on a valid admin key ⇒ the lnurlp extension isn't enabled for this wallet.
    // Enable it once and retry; if it still fails, the real error propagates.
    if (e instanceof HttpError && e.status === 403 && cfg.userId) {
      await enable(cfg.userId);
      await create();
    } else {
      throw e;
    }
  }

  return { lnAddress: `${name}@${LN_ADDRESS_DOMAIN}` };
}
