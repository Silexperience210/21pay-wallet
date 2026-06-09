// The keystone WalletBackend interface. Sections depend ONLY on this interface
// (CLAUDE.md constraint 5). Concrete backends live in ./backends/* and are never
// imported by sections — they reach the active backend through useWallet().
import type { BackendKind, WalletCapabilities, WalletTx } from './types';

export interface WalletBackend {
  readonly kind: BackendKind;
  readonly capabilities: WalletCapabilities;

  getBalance(): Promise<{ lightningSat: number; onchainSat?: number }>;
  createInvoice(amountSat: number, memo?: string): Promise<{ bolt11: string }>;
  payInvoice(bolt11: string): Promise<{ preimage: string; feeSat: number }>;
  payLnAddress(addr: string, amountSat: number): Promise<{ preimage: string }>;

  // Capability-gated on-chain methods (present only when capabilities.onchain).
  getOnchainAddress?(): Promise<{ address: string }>;
  sendOnchain?(address: string, amountSat: number, feeRate?: number): Promise<{ txid: string }>;

  listTransactions(cursor?: string): Promise<{ txs: WalletTx[]; next?: string }>;
}
