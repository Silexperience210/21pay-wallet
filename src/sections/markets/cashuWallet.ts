// Hunch Cashu wallet — a real balance you can top up and withdraw, on the operator's
// pre-audit mainnet mint (funded by the in-app mainnet wallet). The deposit is
// CRASH-SAFE: the mint quote is persisted BEFORE paying, so a paid-but-unminted deposit
// is always re-mintable on the next open (the root cause of "paid but not credited").
//
// Balance proofs are bearer money → secure store. Pending quotes → prefs store (a quote
// alone can't spend; only the PAID mint can issue tokens against it).
import type { SectionCapabilities } from '../capabilities';
import * as cashu from './lib/wallet';
import type { Proof } from './lib/wallet';

export interface PendingDeposit {
  id: string;
  mintUrl: string;
  /** The cashu-ts mint quote (opaque) — needed to re-mint once the invoice is PAID. */
  quote: unknown;
  amountSat: number;
  createdAt: number;
}

const balanceKey = (mintUrl: string) => `markets.cashu.${mintUrl}`;
const PENDING_KEY = 'markets.cashuPending';

// ── Balance (secure store) ────────────────────────────────────────────────────
export async function loadBalance(caps: SectionCapabilities, mintUrl: string): Promise<Proof[]> {
  try {
    const raw = await caps.store.getSecret(balanceKey(mintUrl));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Proof[]) : [];
  } catch {
    return [];
  }
}

async function saveBalance(caps: SectionCapabilities, mintUrl: string, proofs: Proof[]): Promise<void> {
  await caps.store.setSecret(balanceKey(mintUrl), JSON.stringify(proofs));
}

export async function balanceTotal(caps: SectionCapabilities, mintUrl: string): Promise<number> {
  return cashu.proofsTotal(await loadBalance(caps, mintUrl));
}

// ── Pending deposits (prefs store) ────────────────────────────────────────────
export async function loadPending(caps: SectionCapabilities): Promise<PendingDeposit[]> {
  try {
    const raw = await caps.store.get(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingDeposit[]) : [];
  } catch {
    return [];
  }
}

async function savePending(caps: SectionCapabilities, list: PendingDeposit[]): Promise<void> {
  await caps.store.set(PENDING_KEY, JSON.stringify(list));
}

async function removePending(caps: SectionCapabilities, id: string): Promise<void> {
  await savePending(caps, (await loadPending(caps)).filter((p) => p.id !== id));
}

/** Add `proofs` to the stored balance for `mintUrl`. */
async function creditBalance(caps: SectionCapabilities, mintUrl: string, proofs: Proof[]): Promise<void> {
  await saveBalance(caps, mintUrl, [...(await loadBalance(caps, mintUrl)), ...proofs]);
}

const isAlreadyIssued = (e: unknown): boolean =>
  e instanceof Error && /issued|already|spent/i.test(e.message);

// ── Deposit (funded by the in-app wallet) ─────────────────────────────────────
/** Top up: mint a deposit quote, persist it, pay the invoice from the in-app wallet,
 *  then mint + credit. Returns the credited sat. A failure after payment leaves the
 *  pending entry so recoverPending() credits it on the next open — funds are never lost. */
export async function deposit(caps: SectionCapabilities, mintUrl: string, amountSat: number): Promise<number> {
  if (!Number.isInteger(amountSat) || amountSat < 1) throw new Error('deposit amount must be >= 1 sat');
  const wallet = await cashu.connect(mintUrl);
  const { quote, invoice } = await cashu.depositQuote(wallet, amountSat);
  if (!invoice) throw new Error('mint returned no invoice');

  const pending: PendingDeposit = { id: `dep-${Date.now()}`, mintUrl, quote, amountSat, createdAt: Math.floor(Date.now() / 1000) };
  // CRASH-SAFETY: persist the quote BEFORE moving any money.
  await savePending(caps, [pending, ...(await loadPending(caps))]);

  await caps.wallet.payInvoice(invoice); // mainnet in-app wallet → mainnet mint

  await cashu.waitPaid(wallet, quote);
  const proofs = await cashu.mintPlain(wallet, amountSat, quote);
  await creditBalance(caps, mintUrl, proofs);
  await removePending(caps, pending.id);
  return cashu.proofsTotal(proofs);
}

/** Credit any pending deposit whose invoice is now PAID at the mint (call on screen open).
 *  Returns the total sat credited this pass. Crash/restart recovery for "paid not credited". */
export async function recoverPending(caps: SectionCapabilities): Promise<number> {
  let credited = 0;
  for (const p of await loadPending(caps)) {
    try {
      const wallet = await cashu.connect(p.mintUrl);
      if (!(await cashu.isQuotePaid(wallet, p.quote))) continue; // not paid yet — keep waiting
      const proofs = await cashu.mintPlain(wallet, p.amountSat, p.quote);
      await creditBalance(caps, p.mintUrl, proofs);
      await removePending(caps, p.id);
      credited += cashu.proofsTotal(proofs);
    } catch (e) {
      // Already issued/spent → the tokens can't be re-minted; drop the dead entry so it
      // stops blocking. Anything else (network) → leave it for the next pass.
      if (isAlreadyIssued(e)) await removePending(caps, p.id).catch(() => {});
    }
  }
  return credited;
}

// ── Withdraw (back to the in-app wallet) ──────────────────────────────────────
/** Melt `amountSat` of the balance to a fresh in-app wallet invoice. Returns sat paid. */
export async function withdraw(caps: SectionCapabilities, mintUrl: string, amountSat: number): Promise<number> {
  if (!Number.isInteger(amountSat) || amountSat < 1) throw new Error('withdraw amount must be >= 1 sat');
  const balance = await loadBalance(caps, mintUrl);
  const total = cashu.proofsTotal(balance);
  if (amountSat > total) throw new Error('amount exceeds balance');
  const wallet = await cashu.connect(mintUrl);
  const { bolt11 } = await caps.wallet.createInvoice(amountSat, 'Hunch withdrawal');
  const { change, paid } = await cashu.meltToInvoice(wallet, balance, bolt11);
  await saveBalance(caps, mintUrl, change);
  return paid || amountSat;
}
