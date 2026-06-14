// Cashu wallet helpers — ported from hunch-web (the flow proven live against
// cdk-mintd in Hunch CI). Deposit pays a Lightning invoice via the IN-APP wallet
// capability (not WebLN), then mints outcome tokens P2PK-locked to L_X (NUT-11);
// redeem signs with l_X after attestation; melt sends winnings back to the wallet.
import { Wallet, type Proof } from '@cashu/cashu-ts';

export type { Proof };

export async function connect(mintUrl: string): Promise<Wallet> {
  const wallet = new Wallet(mintUrl, { unit: 'sat' });
  await wallet.loadMint();
  return wallet;
}

export interface MintQuote {
  quote: unknown;
  invoice: string;
}

/** Creates a mint quote; returns the quote object and its bolt11 invoice to pay. */
export async function depositQuote(wallet: Wallet, amount: number): Promise<MintQuote> {
  const quote = (await wallet.createMintQuote('bolt11', { amount, unit: 'sat' })) as {
    request?: string;
    invoice?: string;
  };
  return { quote, invoice: quote.request ?? quote.invoice ?? '' };
}

/** Waits until the mint marks the quote PAID (or throws after `tries` polls). */
export async function waitPaid(wallet: Wallet, quote: unknown, tries = 120): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const status = (await wallet.checkMintQuote('bolt11', quote as never)) as { state?: string };
    if (status.state === 'PAID') return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('mint quote not paid in time');
}

/** Mints `amount` sat of proofs P2PK-locked to `lockPubkey` (L_X), reclaimable by
 *  `refundPubkey` (B) after `locktime` — the HIP-3 outcome-token lock. */
export async function mintLocked(
  wallet: Wallet,
  amount: number,
  quote: unknown,
  lockPubkey: string,
  refundPubkey: string,
  locktime: number,
): Promise<Proof[]> {
  return wallet.mintProofs('bolt11', amount, quote as never, undefined, {
    type: 'p2pk',
    options: { pubkey: lockPubkey, locktime, refundKeys: [refundPubkey] },
  });
}

/** Redeems P2PK-locked proofs by signing with `spendPrivkey` (l_X, or b on the refund
 *  path after locktime). Returns fresh unlocked proofs. */
export async function redeem(wallet: Wallet, proofs: Proof[], spendPrivkey: string): Promise<Proof[]> {
  return wallet.receive(proofs, { privkey: spendPrivkey });
}

/** Mints `amount` sat of plain (unlocked) proofs once the quote is PAID — a wallet top-up
 *  (no outcome lock). Use after waitPaid confirms the deposit invoice settled. */
export async function mintPlain(wallet: Wallet, amount: number, quote: unknown): Promise<Proof[]> {
  return wallet.mintProofs('bolt11', amount, quote as never);
}

/** True once the mint marks the quote PAID — a single, non-blocking probe (for recovery). */
export async function isQuotePaid(wallet: Wallet, quote: unknown): Promise<boolean> {
  const status = (await wallet.checkMintQuote('bolt11', quote as never)) as { state?: string };
  return status.state === 'PAID';
}

function amountToNumber(a: unknown): number {
  if (typeof a === 'number') return a;
  if (typeof a === 'bigint') return Number(a);
  const v = (a as { value?: unknown })?.value;
  return typeof v === 'bigint' ? Number(v) : Number(v ?? 0);
}

export function proofsTotal(proofs: Proof[]): number {
  return proofs.reduce((sum, p) => sum + amountToNumber(p.amount), 0);
}

/** Withdraw: melts `proofs` to pay a bolt11 `invoice` (winnings → in-app wallet). */
export async function meltToInvoice(
  wallet: Wallet,
  proofs: Proof[],
  invoice: string,
): Promise<{ change: Proof[]; paid: number; fee: number }> {
  const quote = await wallet.createMeltQuoteBolt11(invoice);
  const paid = amountToNumber((quote as { amount?: unknown }).amount);
  const fee = amountToNumber((quote as { fee_reserve?: unknown }).fee_reserve);
  const res = (await wallet.meltProofsBolt11(quote, proofs)) as { change?: Proof[] };
  return { change: res.change ?? [], paid, fee };
}
