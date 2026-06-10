// NwcRemote — WalletBackend over @getalby/sdk NWCClient (NIP-47 / bring-your-own-node).
// Pure JS: the SDK speaks to the user's node over a relay WebSocket; this adapter only
// maps SDK results to the WalletBackend shape and converts msat<->sat at the boundary.
//
// IDENT-03 / CLAUDE.md #2 (blast-radius): the per-connection secret comes ONLY from the
// connection URI (cfg.uri). This file NEVER imports core key material, so a leaked NWC
// secret can never move identity/spending funds. The concrete class is intentionally NOT
// exported from the wallet barrel (CLAUDE.md #5) — sections reach it via useWallet() only.
import { NWCClient } from '@getalby/sdk';
import type { WalletBackend } from '../WalletBackend';
import type { PaymentStatus, WalletCapabilities, WalletTx } from '../types';
import { httpRequest } from '../../core/net';
import { transition } from './paymentStateMachine';

/** Connection config — built from a `nostr+walletconnect://` URI (also consumed by 04-03). */
export interface NwcConnectionConfig {
  id: string; // stable UUID, used as the vault key
  name: string; // user label, e.g. "Alby"
  walletPubkey: string; // from the URI
  relayUrl: string; // from the URI
  uri: string; // full URI — carries the per-connection secret (D-04)
  requestedBudgetSat?: number; // optional cap the connection was minted with — pass-through only
}

/** Read-only, node-enforced budget (D-03). NEVER a locally-computed/enforced cap. */
export interface NodeBudget {
  usedSat: number;
  totalSat: number;
  renewsAt?: number;
  requestedSat?: number; // echoed only when the connection was minted with a requestable cap
}

const SPENDING_MINIMUM = ['pay_invoice', 'make_invoice', 'get_balance'] as const;

/** lookup_invoice → PaymentStatus (NWC reports settlement via settled_at). */
function mapNwcToStatus(
  resp: { settled_at?: number | null; failed?: boolean },
  now: number,
  expiresAt?: number,
): PaymentStatus {
  if (resp.settled_at != null) return 'settled';
  if (resp.failed === true) return 'failed';
  if (expiresAt != null && now > expiresAt) return 'expired';
  return 'pending';
}

interface NwcTx {
  payment_hash: string;
  amount: number; // msats
  type?: string;
  settled_at?: number; // unix seconds
  description?: string;
}

export class NwcRemote implements WalletBackend {
  readonly kind = 'nwc' as const;
  // NWC has no on-chain capability (D-09/discretion).
  readonly capabilities: WalletCapabilities = { onchain: false, lnSend: true, lnReceive: true };

  private readonly client: NWCClient;
  private methods: string[] | null = null; // populated by negotiate()

  constructor(private readonly cfg: NwcConnectionConfig) {
    // The SDK parses the URI and extracts the per-connection secret (D-04). No identity key.
    this.client = new NWCClient({ nostrWalletConnectUrl: cfg.uri });
  }

  /** Negotiate supported methods from the node. Must succeed before use as a spending
   *  backend — throws if the spending minimum is unmet (O-3). */
  async negotiate(): Promise<string[]> {
    const info = await this.client.getInfo();
    const methods = info.methods ?? [];
    const missing = SPENDING_MINIMUM.filter((m) => !methods.includes(m));
    if (missing.length > 0) {
      throw new Error('node cannot act as a spending backend');
    }
    this.methods = methods;
    return methods;
  }

  /** Optimistic before negotiate(); gated on the negotiated set afterward (graceful degrade). */
  private supports(method: string): boolean {
    return this.methods == null ? true : this.methods.includes(method);
  }

  async getBalance(): Promise<{ lightningSat: number }> {
    const { balance } = await this.client.getBalance(); // msats
    return { lightningSat: Math.floor((balance ?? 0) / 1000) };
  }

  async createInvoice(amountSat: number, memo?: string): Promise<{ bolt11: string; paymentHash?: string }> {
    const res = await this.client.makeInvoice({ amount: amountSat * 1000, description: memo });
    return { bolt11: res.invoice, paymentHash: res.payment_hash };
  }

  async payInvoice(bolt11: string): Promise<{ preimage: string; feeSat: number; paymentHash?: string }> {
    const res = await this.client.payInvoice({ invoice: bolt11 });
    return { preimage: res.preimage, feeSat: Math.floor((res.fees_paid ?? 0) / 1000) };
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
    const { preimage } = await this.payInvoice(inv.data.pr);
    return { preimage };
  }

  async listTransactions(): Promise<{ txs: WalletTx[]; next?: string }> {
    if (!this.supports('list_transactions')) return { txs: [] }; // O-3 graceful degrade
    const res = await this.client.listTransactions({});
    const txs: WalletTx[] = ((res.transactions ?? []) as NwcTx[]).map((t) => {
      const out = t.type === 'outgoing' || t.amount < 0;
      return {
        id: t.payment_hash,
        paymentHash: t.payment_hash,
        direction: out ? 'out' : 'in',
        amountSat: Math.floor(Math.abs(t.amount) / 1000),
        status: t.settled_at != null ? 'settled' : 'pending',
        createdAt: (t.settled_at ?? Math.floor(Date.now() / 1000)) * 1000,
        memo: t.description,
      };
    });
    return { txs };
  }

  async reconcile(paymentHash: string, from: PaymentStatus = 'pending', expiresAt?: number): Promise<PaymentStatus> {
    if (!this.supports('lookup_invoice')) return from; // can't poll → leave as-is
    const res = await this.client.lookupInvoice({ payment_hash: paymentHash });
    return transition(from, mapNwcToStatus(res, Date.now(), expiresAt));
  }

  /** Read-only, node-enforced budget (D-03). Returns null when the node doesn't expose
   *  get_budget → the UI shows "set a limit on your node" guidance. Never a local cap. */
  async readBudget(): Promise<NodeBudget | null> {
    if (!this.supports('get_budget')) return null;
    // The SDK's budget response shape varies by version; read the NIP-47 fields defensively.
    const b = (await this.client.getBudget()) as {
      used_budget?: number;
      total_budget?: number;
      renews_at?: number;
    };
    return {
      usedSat: Math.floor((b.used_budget ?? 0) / 1000),
      totalSat: Math.floor((b.total_budget ?? 0) / 1000),
      renewsAt: b.renews_at,
      // D-03 request branch: echo the requested cap only when the connection was minted with one
      // (create_connection/Alby OAuth). Pasted static URIs can't carry a client-set cap (Pitfall 2).
      requestedSat: this.cfg.requestedBudgetSat,
    };
  }

  /** Pitfall 1: the NWC relay socket is disposable. Close on background/deactivate. */
  close(): void {
    this.client.close();
  }
}
