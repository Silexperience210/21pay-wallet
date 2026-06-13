// Shared wallet domain types. Pure types/consts only — no IO.
// The Core boundary (CLAUDE.md constraint 5): sections depend on these + the
// WalletBackend interface, never on a concrete backend.

// WALLET-09: payment status is a closed 4-member state machine.
export type PaymentStatus = 'pending' | 'settled' | 'failed' | 'expired';

export const PAYMENT_TERMINAL = ['settled', 'failed', 'expired'] as const;

export function isTerminalStatus(s: PaymentStatus): boolean {
  return (PAYMENT_TERMINAL as readonly string[]).includes(s);
}

export type BackendKind = 'custodial-lnbits' | 'nwc' | 'self-hosted' | 'ark';

export interface WalletCapabilities {
  onchain: boolean;
  lnSend: boolean;
  lnReceive: boolean;
}

// ONBD-05: lightning and onchain are SEPARATE fields, tagged by backend.
// NO merged total field — ONBD-05 forbids one spendable number across backends.
export interface PerBackendBalance {
  backendKind: BackendKind;
  lightningSat: number;
  onchainSat?: number;
}

export interface WalletTx {
  id: string;
  paymentHash?: string;
  direction: 'in' | 'out';
  amountSat: number;
  feeSat?: number;
  status: PaymentStatus;
  createdAt: number;
  memo?: string;
  /** How the transaction settled: Lightning or on-chain (Boltz swap). */
  source?: 'lightning' | 'onchain';
}
