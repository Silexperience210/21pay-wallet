// The keystone WalletBackend interface. Sections depend ONLY on this interface
// (CLAUDE.md constraint 5). Concrete backends live in ./backends/* and are never
// imported by sections — they reach the active backend through useWallet().
import type { BackendKind, PaymentStatus, WalletCapabilities, WalletTx } from './types';

export interface WalletBackend {
  readonly kind: BackendKind;
  readonly capabilities: WalletCapabilities;

  getBalance(): Promise<{ lightningSat: number; onchainSat?: number }>;
  createInvoice(amountSat: number, memo?: string): Promise<{ bolt11: string; paymentHash?: string }>;
  payInvoice(bolt11: string): Promise<{ preimage: string; feeSat: number; paymentHash?: string }>;
  payLnAddress(addr: string, amountSat: number): Promise<{ preimage: string; paymentHash?: string }>;

  // Capability-gated on-chain methods (present only when capabilities.onchain).
  getOnchainAddress?(amountSat?: number): Promise<{ address: string; swapId?: string }>;
  sendOnchain?(
    address: string,
    amountSat: number,
    feeRate?: number,
    onProgress?: (step: 'creating' | 'payingHold' | 'awaitingLockup' | 'claiming' | 'broadcasting' | 'done') => void,
  ): Promise<{ txid: string }>;
  getOnchainReceiveQuote?(amountSat: number): Promise<{ min: number; max: number; expectedAmount: number; feeSat: number }>;
  getOnchainSendQuote?(amountSat: number): Promise<{ min: number; max: number; onchainAmount: number; feeSat: number }>;

  listTransactions(cursor?: string): Promise<{ txs: WalletTx[]; next?: string }>;

  // Advance a payment to its terminal WALLET-09 state by polling the backend.
  // Optional: synchronous backends may settle on the pay call itself.
  reconcile?(paymentHash: string, from?: PaymentStatus, expiresAt?: number): Promise<PaymentStatus>;

  // Advance a Boltz swap to its terminal state. Only present for on-chain-capable backends.
  reconcileSwap?(swapId: string): Promise<PaymentStatus>;

  // Refund an expired submarine swap back to the user's on-chain address.
  refundSubmarineSwap?(swapId: string, destinationAddress: string, feeRate?: number): Promise<{ txid: string }>;

  // Capability-gated: produce an LNURL-withdraw link to present as an HCE card so a
  // terminal can PULL a payment (BoltCard-style tap-to-pay). Needs the LNbits
  // withdraw/boltcards extension; absent → feature unavailable.
  getWithdrawLink?(amountSat: number): Promise<{ lnurl: string }>;
}
