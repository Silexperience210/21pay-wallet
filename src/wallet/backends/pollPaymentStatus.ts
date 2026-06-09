// Drive a payment to its terminal WALLET-09 state by polling the backend's
// reconcile(). Used by the Send UI so the status sheet reflects the REAL settlement
// instead of assuming "settled" the instant the pay call returns (matters for async
// backends). Pure control-flow — sleep is injectable so tests don't wait.
import type { PaymentStatus } from '../types';
import { isTerminalStatus } from '../types';

export interface PollOptions {
  attempts?: number;
  intervalMs?: number;
  expiresAt?: number;
  sleep?: (ms: number) => Promise<void>;
}

type Reconcile = (paymentHash: string, from?: PaymentStatus, expiresAt?: number) => Promise<PaymentStatus>;

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Poll `reconcile` until the payment reaches a terminal state or attempts run out.
 * Returns the last observed status (terminal, or 'pending' if still unsettled). A
 * reconcile error stops polling and returns the last known status (never throws).
 */
export async function pollUntilTerminal(
  reconcile: Reconcile,
  paymentHash: string,
  { attempts = 5, intervalMs = 1500, expiresAt, sleep = defaultSleep }: PollOptions = {},
): Promise<PaymentStatus> {
  let status: PaymentStatus = 'pending';
  for (let i = 0; i < attempts; i++) {
    try {
      status = await reconcile(paymentHash, status, expiresAt);
    } catch {
      return status; // backend hiccup — keep the last known status, don't crash the UI
    }
    if (isTerminalStatus(status)) return status;
    if (i < attempts - 1) await sleep(intervalMs);
  }
  return status;
}
