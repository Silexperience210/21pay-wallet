// Bet + settlement orchestration (MARKET-03/04) — the proven Hunch wallet flow
// rewired onto the section capability seam:
//   stake: mint-quote invoice paid by the IN-APP wallet (explicit CTA upstream,
//          never auto-paid) → cashu proofs NUT-11 P2PK-locked to L_X (refund B)
//   order: kind-38888 bid signed by the MASTER identity via signer.signHunchEvent
//          (best-effort publish — the stake is the source of truth)
//   settle: l_X = b + s_X unlocks the proofs after attestation → melted back to a
//          wallet invoice, winnings land in the in-app wallet (D-04).
import type { SectionCapabilities } from '../capabilities';
import type { Market, OracleAnnounce, OracleAttestation } from './lib/hunch';
import { buildOrderTemplate } from './lib/build';
import { publishToRelays } from './lib/relay';
import { randomBettorSecret, compressedPubkey, outcomeLockKey, outcomeUnlockSecret } from './lib/dlc';
import * as cashu from './lib/wallet';
import { addPosition, loadBettorSecret, removePosition, updatePosition, type BetPosition } from './positions';
import { HUNCH_RELAYS, BET_MIN_SAT, BET_MAX_SAT, mintUrlForMarket } from './marketsConfig';

export interface PlaceBetOpts {
  outcome: 'YES' | 'NO';
  amountSat: number;
  /** Order price (implied percent paid per token, 1..99) for the published bid. */
  price: number;
}

/** Full bet: stake at the mint (locked to L_X) + publish the Core-signed order.
 *  Throws with a human-meaningful message; the caller renders it (layer 3). */
export async function placeBet(
  caps: SectionCapabilities,
  market: Market,
  announce: OracleAnnounce,
  opts: PlaceBetOpts,
): Promise<BetPosition> {
  if (!Number.isInteger(opts.amountSat) || opts.amountSat < BET_MIN_SAT || opts.amountSat > BET_MAX_SAT) {
    throw new Error(`amount out of bounds (${BET_MIN_SAT}-${BET_MAX_SAT} sats)`);
  }
  if (!Number.isInteger(opts.price) || opts.price < 1 || opts.price > 99) {
    throw new Error('price must be 1..99');
  }

  // Per-position stake key (NOT the Nostr identity, D-03).
  const b = randomBettorSecret();
  const B = compressedPubkey(b);
  const lockKey = outcomeLockKey(B, market.oracle, announce.nonce, market.id, opts.outcome);

  // Stake: deposit invoice from the mint, paid by the in-app wallet.
  const wallet = await cashu.connect(mintUrlForMarket(market.mint));
  const { quote, invoice } = await cashu.depositQuote(wallet, opts.amountSat);
  if (!invoice) throw new Error('mint returned no invoice');

  // FUNDS-SAFETY: persist the position (and the stake key b) BEFORE paying. If the
  // app dies between the payment and the mint, the quote is PAID at the mint and
  // only b + the quote can ever recover it — they must already be on disk.
  const position: BetPosition = {
    id: `${market.d}-${Date.now()}`,
    marketId: market.id,
    question: market.content.question,
    outcome: opts.outcome,
    amountSat: opts.amountSat,
    mintUrl: mintUrlForMarket(market.mint),
    oracle: market.oracle,
    nonce: announce.nonce,
    locktime: market.refundTimeout,
    proofs: [], // filled after the mint below
    createdAt: Math.floor(Date.now() / 1000),
    status: 'open',
  };
  await addPosition(caps, position, b);

  try {
    await caps.wallet.payInvoice(invoice);
  } catch (e) {
    // The payment itself failed — no sats moved, the placeholder can go.
    await removePosition(caps, position.id).catch(() => {});
    throw e;
  }
  await cashu.waitPaid(wallet, quote);
  const proofs = await cashu.mintLocked(wallet, opts.amountSat, quote, lockKey, B, market.refundTimeout);
  await updatePosition(caps, position.id, { proofs });
  position.proofs = proofs;

  // Publish the Core-signed order (MARKET-03). Best-effort: the stake is already
  // safe in the position; an unreachable relay must not throw the bet away.
  try {
    const template = buildOrderTemplate({
      market: market.id,
      side: opts.outcome,
      amount: opts.amountSat,
      price: opts.price,
      kind: 'bid',
      expires: market.expiry,
    });
    const signed = await caps.signer.signHunchEvent(template);
    await publishToRelays(HUNCH_RELAYS, signed);
  } catch {
    /* order publish is advisory; position stands */
  }

  return position;
}

export type SettleResult =
  | { kind: 'won'; redeemedSat: number }
  | { kind: 'lost' }
  | { kind: 'refunded'; redeemedSat: number }
  | { kind: 'not-yet'; reason: 'locktime' };

/** Settle a position against a VERIFIED attestation: winners redeem with l_X and the
 *  sats are melted back into the in-app wallet; losers keep `b` for the post-locktime
 *  refund branch. INVALID routes to the refund path once the locktime passes. */
export async function settlePosition(
  caps: SectionCapabilities,
  position: BetPosition,
  attestation: OracleAttestation,
): Promise<SettleResult> {
  if (position.proofs.length === 0 && !position.unlockedProofs) {
    // The stake never completed (payment without mint) — nothing redeemable here.
    throw new Error('stake incomplete — no tokens were minted for this position');
  }
  const b = await loadBettorSecret(caps, position.id);
  if (!b) throw new Error('stake key missing for this position');

  if (attestation.outcome === position.outcome) {
    const l = outcomeUnlockSecret(b, attestation.signature);
    const redeemedSat = await redeemAndMelt(caps, position, l);
    await updatePosition(caps, position.id, { status: 'won', redeemedSat });
    return { kind: 'won', redeemedSat };
  }

  if (attestation.outcome === 'INVALID') {
    if (Math.floor(Date.now() / 1000) < position.locktime) {
      return { kind: 'not-yet', reason: 'locktime' }; // refund branch opens at locktime
    }
    const redeemedSat = await redeemAndMelt(caps, position, b);
    await updatePosition(caps, position.id, { status: 'refunded', redeemedSat });
    return { kind: 'refunded', redeemedSat };
  }

  // Opposite outcome attested — the lock key can never be unlocked; `b` is kept for
  // the refund branch after locktime (handled by refundPosition).
  await updatePosition(caps, position.id, { status: 'lost' });
  return { kind: 'lost' };
}

/** Post-locktime reclaim with the refund key `b` (INVALID / oracle silence). */
export async function refundPosition(caps: SectionCapabilities, position: BetPosition): Promise<number> {
  if (Math.floor(Date.now() / 1000) < position.locktime) {
    throw new Error('refund locktime not reached yet');
  }
  const b = await loadBettorSecret(caps, position.id);
  if (!b) throw new Error('stake key missing for this position');
  const redeemedSat = await redeemAndMelt(caps, position, b);
  await updatePosition(caps, position.id, { status: 'refunded', redeemedSat });
  return redeemedSat;
}

/** Unlock the proofs with `privkey`, then melt them onto a fresh in-app wallet
 *  invoice (a small fee reserve is left at the mint side).
 *
 *  RETRY-SAFE: the redeem SWAP spends the locked proofs at the mint — if the melt
 *  then failed without persisting, the unlocked proofs would be lost. So the
 *  unlocked proofs are persisted into the position BEFORE melting; a retry skips
 *  the redeem (unlockedProofs flag) and goes straight to the melt. */
async function redeemAndMelt(
  caps: SectionCapabilities,
  position: BetPosition,
  privkey: string,
): Promise<number> {
  const wallet = await cashu.connect(position.mintUrl);
  let unlocked = position.proofs;
  if (!position.unlockedProofs) {
    unlocked = await cashu.redeem(wallet, position.proofs, privkey);
    // Persist FIRST — from here the locked proofs are spent and these are the money.
    await updatePosition(caps, position.id, { proofs: unlocked, unlockedProofs: true });
  }
  const total = cashu.proofsTotal(unlocked);
  // Melt fee reserve comes out of the proofs: invoice slightly under the total.
  const payable = Math.max(1, total - Math.max(2, Math.ceil(total * 0.01)));
  const { bolt11 } = await caps.wallet.createInvoice(payable, 'Hunch settlement');
  const { paid } = await cashu.meltToInvoice(wallet, unlocked, bolt11);
  return paid || payable;
}
