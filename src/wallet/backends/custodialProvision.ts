// Opens a fresh custodial wallet on the 21pay LNbits instance (ONBD-01).
// LNbits v1 merged account/wallet management into core: POST /api/v1/account
// creates a fresh wallet+account and returns its own keys — no admin key required
// (the old UserManager extension is capped at <1.0.0 and is NOT used).
// The returned config carries the NEW wallet's keys; 21pay holds the funds (custodial).
import { httpRequest } from '../../core/net';
import { lnbitsBaseUrl, type CustodialLnbitsConfig } from '../lnbitsConfig';
import { enableFreeExtensions } from '../lnbitsExtensions';

interface LnbitsAccountResponse {
  id: string; // wallet id
  user: string; // user id
  adminkey: string;
  inkey: string;
  name: string;
}

export async function createCustodialAccount(opts?: { name?: string }): Promise<CustodialLnbitsConfig> {
  const baseUrl = lnbitsBaseUrl();
  const res = await httpRequest<LnbitsAccountResponse>({
    baseUrl,
    path: '/api/v1/account',
    method: 'POST',
    body: { name: opts?.name ?? `21pay-${Date.now()}` },
  });
  const a = res.data;
  if (!a?.adminkey || !a?.inkey) throw new Error('LNbits did not return wallet keys');
  // Fresh accounts have NO extensions enabled — turn on the free ones the wallet's
  // features need (lnurlp/withdraw). Best-effort: never blocks account creation.
  if (a.user) await enableFreeExtensions(a.user).catch(() => {});
  // The running app uses the NEW wallet's own credentials.
  return { baseUrl, adminKey: a.adminkey, invoiceKey: a.inkey, readKey: a.inkey, userId: a.user };
}
