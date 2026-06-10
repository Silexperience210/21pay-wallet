// SelfHostedSpark — WalletBackend over the Breez Spark SDK (self-sovereign custody).
//
// PLACEHOLDER (Phase 4 Wave 2 / 04-03): this stub lets the provider seam (activateSelfHosted,
// rehydrate) compile and be wired/tested NOW, while the real Rust-FFI Spark implementation
// lands in 04-05 — which is gated behind the 04-04 release-Hermes device checkpoint and the
// Breez API key. v1 is LN-only: capabilities.onchain = false (D-09). The methods throw until
// 04-05 fills them in, so accidentally activating Spark before it's implemented fails loudly
// rather than silently misbehaving.
import type { WalletBackend } from '../WalletBackend';
import type { WalletCapabilities, WalletTx } from '../types';
import type { SparkConfig } from '../sparkConfig';

const NOT_READY = 'Spark backend not yet available (implemented in Phase 4 / 04-05, after the device checkpoint)';

export class SelfHostedSpark implements WalletBackend {
  readonly kind = 'self-hosted' as const;
  // LN-only in v1 (D-09); on-chain / unilateral exit deferred.
  readonly capabilities: WalletCapabilities = { onchain: false, lnSend: true, lnReceive: true };

  constructor(readonly cfg: SparkConfig) {}

  async getBalance(): Promise<{ lightningSat: number; onchainSat?: number }> {
    throw new Error(NOT_READY);
  }
  async createInvoice(): Promise<{ bolt11: string; paymentHash?: string }> {
    throw new Error(NOT_READY);
  }
  async payInvoice(): Promise<{ preimage: string; feeSat: number; paymentHash?: string }> {
    throw new Error(NOT_READY);
  }
  async payLnAddress(): Promise<{ preimage: string; paymentHash?: string }> {
    throw new Error(NOT_READY);
  }
  async listTransactions(): Promise<{ txs: WalletTx[]; next?: string }> {
    throw new Error(NOT_READY);
  }
}
