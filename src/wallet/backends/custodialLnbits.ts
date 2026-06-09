// CustodialLNbits — first concrete WalletBackend, over the 21pay LNbits REST API.
// Custodial: 21pay holds the funds (the UI badge makes this explicit, ONBD-05).
// API keys come from injected config and are NEVER logged or placed in errors.
// (LNDhub is the documented compatibility path; REST is implemented as primary.)
import type { WalletBackend } from '../WalletBackend';
import type { PaymentStatus, WalletCapabilities, WalletTx } from '../types';
import { httpRequest, enqueue } from '../../core/net';
import type { CustodialLnbitsConfig } from '../lnbitsConfig';
import { mapLnbitsToStatus, transition } from './paymentStateMachine';

export class CustodialLnbits implements WalletBackend {
  readonly kind = 'custodial-lnbits' as const;
  readonly capabilities: WalletCapabilities = { onchain: true, lnSend: true, lnReceive: true };

  constructor(private readonly cfg: CustodialLnbitsConfig) {}

  async getBalance(): Promise<{ lightningSat: number }> {
    const res = await httpRequest<{ balance?: number }>({
      baseUrl: this.cfg.baseUrl,
      path: '/api/v1/wallet',
      apiKey: this.cfg.readKey,
      idempotent: true,
    });
    return { lightningSat: Math.floor((res.data.balance ?? 0) / 1000) }; // msat → sat
  }

  async createInvoice(amountSat: number, memo?: string): Promise<{ bolt11: string }> {
    const res = await httpRequest<{ payment_hash: string; payment_request: string }>({
      baseUrl: this.cfg.baseUrl,
      path: '/api/v1/payments',
      method: 'POST',
      apiKey: this.cfg.invoiceKey,
      body: { out: false, amount: amountSat, memo: memo ?? '' },
    });
    return { bolt11: res.data.payment_request };
  }

  async payInvoice(bolt11: string): Promise<{ preimage: string; feeSat: number; paymentHash?: string }> {
    // Idempotency guard (T-02-12): register the pay; a repeated submission is a no-op.
    const fresh = enqueue({
      dedupeKey: `pay:${bolt11}`,
      request: {
        baseUrl: this.cfg.baseUrl,
        path: '/api/v1/payments',
        method: 'POST',
        apiKey: this.cfg.adminKey,
        body: { out: true, bolt11 },
        idempotent: false,
      },
    });
    if (!fresh) throw new Error('duplicate payment suppressed');

    const res = await httpRequest<{ payment_hash: string; preimage?: string; fee?: number }>({
      baseUrl: this.cfg.baseUrl,
      path: '/api/v1/payments',
      method: 'POST',
      apiKey: this.cfg.adminKey,
      body: { out: true, bolt11 },
      idempotent: false, // a pay is NEVER blindly re-sent at the HTTP layer
    });
    return {
      preimage: res.data.preimage ?? '',
      feeSat: Math.floor(Math.abs(res.data.fee ?? 0) / 1000),
      paymentHash: res.data.payment_hash,
    };
  }

  async payLnAddress(addr: string, amountSat: number): Promise<{ preimage: string; paymentHash?: string }> {
    const [name, domain] = addr.split('@');
    if (!name || !domain) throw new Error('invalid lightning address');
    const meta = await httpRequest<{ callback: string }>({
      baseUrl: `https://${domain}`,
      path: `/.well-known/lnurlp/${name}`,
      idempotent: true,
    });
    const cb = new URL(meta.data.callback);
    const inv = await httpRequest<{ pr: string }>({
      baseUrl: `${cb.origin}${cb.pathname}`,
      path: `?amount=${amountSat * 1000}`,
      idempotent: true,
    });
    const { preimage, paymentHash } = await this.payInvoice(inv.data.pr);
    return { preimage, paymentHash };
  }

  /** Create an LNURL-withdraw link (LNbits withdraw extension) to present as an HCE
   *  card so a terminal can pull `amountSat`. Throws if the extension is disabled. */
  async getWithdrawLink(amountSat: number): Promise<{ lnurl: string }> {
    const res = await httpRequest<{ lnurl: string }>({
      baseUrl: this.cfg.baseUrl,
      path: '/withdraw/api/v1/links',
      method: 'POST',
      apiKey: this.cfg.adminKey,
      body: {
        title: '21pay tap-to-pay',
        min_withdrawable: amountSat,
        max_withdrawable: amountSat,
        uses: 1,
        wait_time: 1,
        is_unique: true,
      },
    });
    if (!res.data.lnurl) throw new Error('withdraw link unavailable');
    return { lnurl: res.data.lnurl };
  }

  async listTransactions(): Promise<{ txs: WalletTx[]; next?: string }> {
    const res = await httpRequest<
      Array<{ payment_hash: string; amount: number; pending?: boolean; time: number; memo?: string }>
    >({
      baseUrl: this.cfg.baseUrl,
      path: '/api/v1/payments',
      apiKey: this.cfg.readKey,
      idempotent: true,
    });
    const txs: WalletTx[] = (res.data ?? []).map((p) => ({
      id: p.payment_hash,
      paymentHash: p.payment_hash,
      direction: p.amount < 0 ? 'out' : 'in',
      amountSat: Math.floor(Math.abs(p.amount) / 1000),
      status: p.pending ? 'pending' : 'settled',
      createdAt: p.time * 1000,
      memo: p.memo,
    }));
    return { txs };
  }

  /** Poll LNbits and advance a pending payment to its terminal state (WALLET-09). */
  async reconcile(
    paymentHash: string,
    from: PaymentStatus = 'pending',
    expiresAt?: number,
  ): Promise<PaymentStatus> {
    const res = await httpRequest<{ paid?: boolean; failed?: boolean }>({
      baseUrl: this.cfg.baseUrl,
      path: `/api/v1/payments/${paymentHash}`,
      apiKey: this.cfg.readKey,
      idempotent: true,
    });
    return transition(from, mapLnbitsToStatus(res.data, Date.now(), expiresAt));
  }
}
