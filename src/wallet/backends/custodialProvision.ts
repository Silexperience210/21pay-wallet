// Opens a fresh custodial account on the 21pay LNbits instance (ONBD-01).
// The LIVE call requires the real 21pay admin key (a per-user secret, never
// committed) — gated by this plan's autonomous:false checkpoint. The returned
// config carries the NEW per-user wallet's keys, NOT the provisioning admin key.
import { httpRequest } from '../../core/net';
import { lnbitsBaseUrl, type CustodialLnbitsConfig } from '../lnbitsConfig';

interface LnbitsUserResponse {
  id: string;
  wallets: Array<{ id: string; adminkey: string; inkey: string }>;
}

export async function createCustodialAccount(
  provisioningAdminKey: string,
  opts?: { username?: string },
): Promise<CustodialLnbitsConfig> {
  const baseUrl = lnbitsBaseUrl();
  // UserManager extension (project memory: no /register web flow — use the API).
  const res = await httpRequest<LnbitsUserResponse>({
    baseUrl,
    path: '/usermanager/api/v1/users',
    method: 'POST',
    apiKey: provisioningAdminKey, // never logged; never returned
    body: { user_name: opts?.username ?? `21pay-${Date.now()}`, wallet_name: '21pay' },
  });
  const wallet = res.data.wallets?.[0];
  if (!wallet) throw new Error('LNbits did not return a wallet');
  // The running app uses the NEW wallet's own credentials, not the admin key.
  return { baseUrl, adminKey: wallet.adminkey, invoiceKey: wallet.inkey, readKey: wallet.inkey };
}
