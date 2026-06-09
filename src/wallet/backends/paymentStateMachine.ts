// WALLET-09: explicit payment state machine. Terminal states are FINAL — a late
// or replayed poll can never resurrect a settled/failed/expired payment.
import { isTerminalStatus, type PaymentStatus } from '../types';

const LEGAL_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['pending', 'settled', 'failed', 'expired'],
  settled: ['settled'],
  failed: ['failed'],
  expired: ['expired'],
};

export function transition(from: PaymentStatus, to: PaymentStatus): PaymentStatus {
  if (isTerminalStatus(from) && from !== to) {
    throw new Error(`illegal payment transition ${from}->${to}`);
  }
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw new Error(`illegal payment transition ${from}->${to}`);
  }
  return to;
}

export function mapLnbitsToStatus(
  resp: { paid?: boolean; failed?: boolean },
  now: number,
  expiresAt?: number,
): PaymentStatus {
  if (resp.paid === true) return 'settled';
  if (resp.failed === true) return 'failed';
  if (expiresAt != null && now > expiresAt) return 'expired';
  return 'pending';
}
