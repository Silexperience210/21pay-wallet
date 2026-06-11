// sendAll — guided custody-migration orchestration (D-06). A transient two-backend
// operation: invoice on the NEW backend, paid from the OLD, behind an explicit user
// confirm (NEVER an auto-sweep). Pure logic: both backends are injected, no
// module-scoped state — fully unit-testable.
//
// Same-node guard (Pitfall 4b) is the CALLER's responsibility: check isSameNode()
// BEFORE calling sendAll, otherwise an NWC backend would pay itself and burn fees.
import type { WalletBackend } from '../WalletBackend';
import { isTerminalStatus } from '../types';
import { pollUntilTerminal } from './pollPaymentStatus';

// LN routing fees come OUT of the migrated balance — sending 100% can never route.
// Tunable; a Spark drain can move to exact-amount FeesIncluded in a later iteration.
export const FEE_RESERVE_RATIO = 0.01;

/** Best-effort node identity compare: true only when BOTH backends expose a node
 *  pubkey (NWC connection config) and they match. Unknown ⇒ false (the UI warns). */
export function isSameNode(a: WalletBackend, b: WalletBackend): boolean {
  const pubkey = (x: WalletBackend): string | undefined =>
    (x as unknown as { cfg?: { walletPubkey?: string } }).cfg?.walletPubkey;
  const pa = pubkey(a);
  const pb = pubkey(b);
  return pa != null && pb != null && pa === pb;
}

/** Move the OLD backend's spendable Lightning balance to the NEW backend (D-06).
 *  - destination must be able to receive (capability gate)
 *  - zero balance ⇒ { moved: 0 } without any payment
 *  - a fee reserve is held back: sendable = floor(balance × (1 − FEE_RESERVE_RATIO))
 *  - the payment is reconciled to a terminal state before the move is declared done */
export async function sendAll(from: WalletBackend, to: WalletBackend): Promise<{ moved: number }> {
  if (!to.capabilities.lnReceive) {
    throw new Error('destination cannot receive');
  }
  const balance = await from.getBalance();
  if (balance.lightningSat <= 0) return { moved: 0 }; // nothing to move — no payment
  const sendable = Math.floor(balance.lightningSat * (1 - FEE_RESERVE_RATIO));
  if (sendable <= 0) {
    throw new Error('balance too small to cover fees');
  }
  const invoice = await to.createInvoice(sendable, '21pay custody migration');
  const paid = await from.payInvoice(invoice.bolt11);
  // Reconcile to terminal before declaring done (async backends may settle late).
  const hash = paid.paymentHash ?? invoice.paymentHash;
  if (from.reconcile && hash) {
    const status = await pollUntilTerminal(from.reconcile.bind(from), hash);
    if (isTerminalStatus(status) && status !== 'settled') {
      throw new Error(`migration payment ${status} — funds did not move`);
    }
  }
  return { moved: sendable };
}
