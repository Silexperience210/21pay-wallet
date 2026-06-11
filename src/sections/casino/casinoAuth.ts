// LNURL-auth (LUD-04) login orchestrator for the casino (D-05). The app IS the
// wallet, so the whole flow runs internally — no QR: generate → decode the LNURL →
// sign k1 with the per-domain Core linking key (via the injected capability bundle,
// constraint 5 — this file NEVER imports walletProvider/core/keys) → callback → poll.
import { lnurlToUrl } from '../../wallet';
import type { SectionCapabilities } from '../capabilities';
import * as casinoApi from './casinoApi';

export type CasinoLoginResult =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'invalid-lnurl' | 'backend' };

/** Run the full internal LNURL-auth flow. Resolves (never throws raw to the
 *  boundary — async errors are NOT caught by React boundaries, CASINO-04 layer 3). */
export async function loginWithLnurlAuth(caps: SectionCapabilities): Promise<CasinoLoginResult> {
  try {
    // (1) the casino mints the k1 challenge inside a bech32 LNURL
    const { lnurl } = await casinoApi.generateAuthUrl();
    // (2) decode → extract k1 + the domain the linking key binds to (LUD-05)
    let k1: string | null = null;
    let domain: string;
    try {
      const url = new URL(lnurlToUrl(lnurl));
      k1 = url.searchParams.get('k1');
      domain = url.hostname;
    } catch {
      return { ok: false, reason: 'invalid-lnurl' };
    }
    if (!k1 || !/^[0-9a-f]{64}$/i.test(k1)) return { ok: false, reason: 'invalid-lnurl' };
    // (3) sign k1 with the per-domain linking key — raw key stays in Core
    const { sig, key } = await caps.signer.signLnurlAuth(k1, domain);
    // (4) submit the LUD-04 callback, (5) poll until the session is minted
    await casinoApi.authCallback(k1, sig, key);
    const status = await casinoApi.pollAuthStatus(k1);
    if (status !== 'authenticated') return { ok: false, reason: 'expired' };
    // (6) session cookie is stored module-side by pollAuthStatus (never returned)
    return { ok: true };
  } catch {
    return { ok: false, reason: 'backend' };
  }
}
