// CustodialLNbits — first concrete WalletBackend, over the 21pay LNbits REST API.
// Custodial: 21pay holds the funds (the UI badge makes this explicit, ONBD-05).
// API keys come from injected config and are NEVER logged or placed in errors.
// (LNDhub is the documented compatibility path; REST is implemented as primary.)
import type { WalletBackend } from '../WalletBackend';
import type { PaymentStatus, WalletCapabilities, WalletTx } from '../types';
import { httpRequest, enqueue } from '../../core/net';
import type { CustodialLnbitsConfig } from '../lnbitsConfig';
import type { BoltzSwapService } from '../boltz';
import { listSwaps } from '../boltz/repository';
import { mapLnbitsToStatus, transition } from './paymentStateMachine';

// LNbits v1 replaced the boolean `pending` with a `status` string ('success' |
// 'pending' | 'failed') in GET /api/v1/payments — verified live against 21pay.org
// 2026-06-11 (the old mapping displayed UNPAID invoices as "Settled"). Map the v1
// string first; fall back to the legacy boolean. Fail-closed: an unknown status is
// 'pending', never invented-settled.
function mapListPaymentStatus(p: { status?: string; pending?: boolean }):
  | 'pending'
  | 'settled'
  | 'failed' {
  if (typeof p.status === 'string') {
    if (p.status === 'success') return 'settled';
    if (p.status === 'failed') return 'failed';
    return 'pending';
  }
  return p.pending ? 'pending' : 'settled'; // legacy <v1 shape
}

// LNbits v1 `time`/`created_at` are ISO datetime strings (legacy was unix seconds).
// The old `p.time * 1000` on a string produced NaN → the 01/01/1970 dates.
function parsePaymentTimeMs(p: { time?: number | string; created_at?: string }): number {
  const t = p.time ?? p.created_at;
  if (typeof t === 'number') return t * 1000; // legacy unix seconds
  if (typeof t === 'string') {
    const ms = Date.parse(t);
    if (!Number.isNaN(ms)) return ms;
  }
  return Date.now(); // last resort — never epoch
}

export class CustodialLnbits implements WalletBackend {
  readonly kind = 'custodial-lnbits' as const;
  readonly capabilities: WalletCapabilities = { onchain: true, lnSend: true, lnReceive: true };

  constructor(
    private readonly cfg: CustodialLnbitsConfig,
    private boltz?: BoltzSwapService,
  ) {}

  /** Wire the Boltz swap service after construction (used by walletProvider). */
  setBoltzService(boltz: BoltzSwapService): void {
    this.boltz = boltz;
  }

  async getBalance(): Promise<{ lightningSat: number }> {
    const res = await httpRequest<{ balance?: number }>({
      baseUrl: this.cfg.baseUrl,
      path: '/api/v1/wallet',
      apiKey: this.cfg.readKey,
      idempotent: true,
    });
    return { lightningSat: Math.floor((res.data.balance ?? 0) / 1000) }; // msat → sat
  }

  async createInvoice(amountSat: number, memo?: string): Promise<{ bolt11: string; paymentHash?: string }> {
    const res = await httpRequest<{ payment_hash: string; payment_request: string }>({
      baseUrl: this.cfg.baseUrl,
      path: '/api/v1/payments',
      method: 'POST',
      apiKey: this.cfg.invoiceKey,
      body: { out: false, amount: amountSat, memo: memo ?? '' },
    });
    return { bolt11: res.data.payment_request, paymentHash: res.data.payment_hash };
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
      Array<{
        payment_hash: string;
        amount: number;
        pending?: boolean; // legacy (<v1) boolean
        status?: string; // LNbits v1: 'success' | 'pending' | 'failed'
        time?: number | string; // legacy unix seconds OR v1 ISO datetime string
        created_at?: string; // v1 ISO datetime
        memo?: string;
      }>
    >({
      baseUrl: this.cfg.baseUrl,
      path: '/api/v1/payments',
      apiKey: this.cfg.readKey,
      idempotent: true,
    });
    const lnTxs: WalletTx[] = (res.data ?? []).map((p) => ({
      id: p.payment_hash,
      paymentHash: p.payment_hash,
      direction: p.amount < 0 ? 'out' : 'in',
      amountSat: Math.floor(Math.abs(p.amount) / 1000),
      status: mapListPaymentStatus(p),
      createdAt: parsePaymentTimeMs(p),
      memo: p.memo,
    }));

    // Include Boltz swaps in the custodial history. Reverse swaps are shown as outgoing
    // on-chain transactions; submarine swaps are shown only while pending (once settled,
    // the corresponding Lightning invoice payment appears in LNbits history).
    const swaps = await listSwaps(200);
    const swapTxs: WalletTx[] = swaps
      .filter((s) => s.direction === 'reverse' || !this.isSwapSettled(s.status))
      .map((s) => ({
        id: `boltz:${s.id}`,
        paymentHash: s.preimageHash || s.id,
        direction: s.direction === 'reverse' ? 'out' : 'in',
        amountSat: s.direction === 'reverse' ? s.onchainAmount ?? 0 : s.expectedAmount ?? 0,
        status: this.mapBoltzStatus(s.status, s.expiresAt),
        createdAt: s.createdAt,
        memo: s.direction === 'reverse' ? `On-chain send${s.claimTxId ? ` · ${s.claimTxId.slice(0, 8)}` : ''}` : 'On-chain deposit',
      }));

    const all = [...lnTxs, ...swapTxs].sort((a, b) => b.createdAt - a.createdAt);
    return { txs: all };
  }

  private isSwapSettled(status: string): boolean {
    return status === 'invoice.settled' || status === 'transaction.claimed' || status === 'transaction.refunded';
  }

  private mapBoltzStatus(status: string, expiresAt: number): PaymentStatus {
    if (status === 'invoice.settled' || status === 'transaction.claimed') return 'settled';
    if (status === 'swap.expired' || status === 'invoice.expired' || Date.now() > expiresAt) return 'expired';
    if (status === 'invoice.failedToPay' || status === 'transaction.refunded' || status === 'transaction.lockupFailed') {
      return 'failed';
    }
    return 'pending';
  }

  /** Poll a Boltz swap and advance it to its terminal state. */
  async reconcileSwap(swapId: string): Promise<PaymentStatus> {
    if (!this.boltz) throw new Error('on-chain unavailable');
    return this.boltz.reconcileSwap(swapId);
  }

  /** On-chain receive: present a Boltz HTLC address that settles into Lightning. */
  async getOnchainAddress(amountSat?: number): Promise<{ address: string; swapId: string }> {
    if (!this.boltz) throw new Error('on-chain unavailable');
    if (amountSat == null || amountSat <= 0) throw new Error('on-chain receive requires an amount');
    const { address, swapId } = await this.boltz.getDepositAddress(amountSat);
    return { address, swapId };
  }

  /** On-chain send: swap Lightning sats out to a Bitcoin address via Boltz. */
  async sendOnchain(
    address: string,
    amountSat: number,
    feeRate?: number,
    onProgress?: (step: 'creating' | 'payingHold' | 'awaitingLockup' | 'claiming' | 'broadcasting' | 'done') => void,
  ): Promise<{ txid: string }> {
    if (!this.boltz) throw new Error('on-chain unavailable');
    return this.boltz.swapOut(address, amountSat, feeRate, onProgress);
  }

  /** Preview fees and limits for receiving on-chain. */
  async getOnchainReceiveQuote(amountSat: number): Promise<{ min: number; max: number; expectedAmount: number; feeSat: number }> {
    if (!this.boltz) throw new Error('on-chain unavailable');
    return this.boltz.getSubmarineQuote(amountSat);
  }

  /** Preview fees, limits and final on-chain amount for sending. */
  async getOnchainSendQuote(amountSat: number): Promise<{ min: number; max: number; onchainAmount: number; feeSat: number }> {
    if (!this.boltz) throw new Error('on-chain unavailable');
    return this.boltz.getReverseQuote(amountSat);
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
