// LNbits per-user extension activation. Fresh accounts have NO extensions enabled,
// so every keyed extension API call (lnurlp links, withdraw links, contentwall
// items…) returns 403 "Extension 'x' not enabled" until activated. Free extensions
// are enabled here via login-by-usr (the account's user id, returned at creation);
// PAID extensions (instance pay_to_enable, e.g. contentwall at 2100 sats on 21pay)
// return 402 and are deliberately NOT auto-paid — the UI surfaces that case.
import { httpRequest } from '../core/net';
import { lnbitsBaseUrl } from './lnbitsConfig';

/** The free extensions the wallet's first-party features depend on:
 *  lnurlp (LN-address claim) + withdraw (HCE tap-to-pay card). */
export const APP_FREE_EXTENSIONS = ['lnurlp', 'withdraw'] as const;

/** POST /api/v1/auth/usr — non-admin login by user id → Bearer access token.
 *  (Admin users are refused by LNbits; app accounts are plain users.) */
export async function loginByUsr(userId: string): Promise<string | null> {
  try {
    const res = await httpRequest<{ access_token?: string }>({
      baseUrl: lnbitsBaseUrl(),
      path: '/api/v1/auth/usr',
      method: 'POST',
      body: { usr: userId },
      idempotent: false,
    });
    return res.data?.access_token ?? null;
  } catch {
    return null;
  }
}

/** PUT /api/v1/extension/{ext}/enable. False on 402 (pay-to-enable) or any error. */
export async function enableExtension(accessToken: string, extId: string): Promise<boolean> {
  try {
    await httpRequest<unknown>({
      baseUrl: lnbitsBaseUrl(),
      path: `/api/v1/extension/${encodeURIComponent(extId)}/enable`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      idempotent: true, // enabling twice is a no-op
    });
    return true;
  } catch {
    return false; // 402 paid / transient — caller decides; never throws
  }
}

/** Best-effort: enable the app's free extensions for a fresh account. Never throws —
 *  a failure only means the LN-address/HCE features will surface their own errors. */
export async function enableFreeExtensions(userId: string): Promise<void> {
  const token = await loginByUsr(userId);
  if (!token) return;
  for (const ext of APP_FREE_EXTENSIONS) {
    await enableExtension(token, ext);
  }
}
