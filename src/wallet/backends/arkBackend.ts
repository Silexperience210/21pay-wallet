// ArkBackend — WalletBackend over Ark / Arkade (self-sovereign L2, 4th custody mode).
//
// PLACEHOLDER stub: lets the provider seam (activateArk, rehydrate) + the ladder
// rung + connect screen compile and be wired NOW, while the real @arkade-os/sdk
// (pre-1.0, native binding) lands in a later device-checkpoint plan — gated behind
// ARK_READY + a release-Hermes proof, exactly like SelfHostedSpark. Methods throw
// until then, so activating Ark before it's implemented fails loudly. Ark settles
// on-chain via VTXOs and bridges Lightning through the ASP, so the eventual real
// backend advertises onchain + LN; the stub keeps the same shape but never runs.
import type { WalletBackend } from '../WalletBackend';
import type { WalletCapabilities, WalletTx } from '../types';
import type { ArkConfig } from '../arkConfig';

const NOT_READY = 'Ark backend not yet available (wired behind the @arkade-os/sdk device checkpoint)';

export class ArkBackend implements WalletBackend {
  readonly kind = 'ark' as const;
  // Ark does on-chain-grade settlement (VTXOs / unilateral exit) + LN via the ASP.
  readonly capabilities: WalletCapabilities = { onchain: true, lnSend: true, lnReceive: true };

  constructor(readonly cfg: ArkConfig) {}

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
