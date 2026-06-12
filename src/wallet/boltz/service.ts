// BoltzSwapService — high-level seam that keeps the wallet Lightning-native while
// adding on-chain receive/send via submarine and reverse swaps. All secrets are
// derived from the Vault mnemonic on demand; no swap keys are persisted in SQLite.
import { hex } from '@scure/base';
import { Transaction, SigHash } from '@scure/btc-signer';
import { loadMnemonic } from '@/core/keys';
import type { CustodialLnbits } from '../backends/custodialLnbits';
import { BoltzClient } from './client';
import type { BoltzConfig } from './config';
import { boltzNetworkName } from './config';
import {
  deriveSwapKeyPair,
  deriveSwapPreimage,
  hashPreimage,
  deserializeSwapTree,
  tweakMusigAggregateKey,
  detectSwapOutput,
  buildCooperativeClaimTransaction,
  generateOurNonce,
  createMuSig2Session,
  toOutputScript,
  type ClaimTxInput,
} from './crypto';
import * as repository from './repository';
import type {
  BoltzStatus,
  CreateReverseSwapRequest,
  CreateSubmarineSwapRequest,
  PersistedSwap,
  ReversePair,
  SubmarinePair,
  SwapAsset,
  SwapDirection,
  SwapQuote,
} from './types';

const SWAP_LIFETIME_MS = 60 * 60 * 1000; // 1 hour; Boltz default invoice expiry
const DEFAULT_FEE_RATE = 5; // sats/vbyte

function nowMs(): number {
  return Date.now();
}

export class BoltzLimitError extends Error {
  constructor(
    readonly min: number,
    readonly max: number,
  ) {
    super(`amount outside Boltz limits (${min}-${max} sats)`);
  }
}

export class BoltzSwapService {
  private readonly client: BoltzClient;
  private keyCounter = 0;

  constructor(
    private readonly cfg: BoltzConfig,
    private readonly lnbits: CustodialLnbits,
  ) {
    this.client = new BoltzClient(cfg.apiUrl);
  }

  async initialize(): Promise<void> {
    const last = repository.listSwaps(1)[0];
    this.keyCounter = last ? last.keyIndex + 1 : 0;
  }

  private nextKeyIndex(): number {
    return this.keyCounter++;
  }

  private async withMnemonic<T>(fn: (mnemonic: string) => T): Promise<T> {
    const mnemonic = await loadMnemonic();
    return fn(mnemonic);
  }

  private async getReversePair(): Promise<ReversePair> {
    const pairs = await this.client.getReversePairs();
    const p = pairs[this.cfg.pair.from]?.[this.cfg.pair.to];
    if (!p) throw new Error('no reverse swap pair available');
    return p;
  }

  private async getSubmarinePair(): Promise<SubmarinePair> {
    const pairs = await this.client.getSubmarinePairs();
    const p = pairs[this.cfg.pair.from]?.[this.cfg.pair.to];
    if (!p) throw new Error('no submarine swap pair available');
    return p;
  }

  private async createPersistedSwap(
    direction: SwapDirection,
    id: string,
    asset: SwapAsset,
    keyIndex: number,
    ourPubHex: string,
    theirPubHex: string,
    preimageHashHex: string,
    swapTree: { claimLeaf: { version: number; output: string }; refundLeaf: { version: number; output: string } },
    lockupAddress: string,
    timeoutBlockHeight: number,
    extras: Partial<PersistedSwap>,
  ): Promise<PersistedSwap> {
    const now = nowMs();
    const swap: PersistedSwap = {
      id,
      direction,
      asset,
      status: 'swap.created',
      createdAt: now,
      expiresAt: now + SWAP_LIFETIME_MS,
      keyIndex,
      ourPublicKey: ourPubHex,
      theirPublicKey: theirPubHex,
      preimageHash: preimageHashHex,
      swapTree,
      lockupAddress,
      timeoutBlockHeight,
      refunded: false,
      ...extras,
    };
    repository.upsertSwap(swap);
    return swap;
  }

  /** Quote for receiving on-chain (submarine swap). */
  async getSubmarineQuote(amountSat: number): Promise<SwapQuote & { expectedAmount: number }> {
    const pair = await this.getSubmarinePair();
    if (amountSat < pair.limits.minimal || amountSat > pair.limits.maximal) {
      throw new BoltzLimitError(pair.limits.minimal, pair.limits.maximal);
    }
    const serviceFee = Math.ceil((amountSat * pair.fees.percentage) / 100);
    return {
      pairHash: pair.hash,
      percentage: pair.fees.percentage,
      minerFees: pair.fees.minerFees,
      min: pair.limits.minimal,
      max: pair.limits.maximal,
      expectedAmount: amountSat,
      feeSat: serviceFee + pair.fees.minerFees,
    };
  }

  /** Quote for sending on-chain (reverse swap). */
  async getReverseQuote(amountSat: number): Promise<SwapQuote & { onchainAmount: number }> {
    const pair = await this.getReversePair();
    if (amountSat < pair.limits.minimal || amountSat > pair.limits.maximal) {
      throw new BoltzLimitError(pair.limits.minimal, pair.limits.maximal);
    }
    const serviceFee = Math.ceil((amountSat * pair.fees.percentage) / 100);
    const onchainAmount = amountSat - serviceFee - pair.fees.minerFees.lockup - pair.fees.minerFees.claim;
    return {
      pairHash: pair.hash,
      percentage: pair.fees.percentage,
      minerFees: pair.fees.minerFees.lockup + pair.fees.minerFees.claim,
      min: pair.limits.minimal,
      max: pair.limits.maximal,
      onchainAmount: Math.max(0, onchainAmount),
      feeSat: serviceFee + pair.fees.minerFees.lockup + pair.fees.minerFees.claim,
    };
  }

  /** Receive on-chain BTC and settle into Lightning (submarine swap). */
  async getDepositAddress(amountSat: number): Promise<{ address: string; swapId: string }> {
    if (amountSat <= 0) throw new Error('amount must be positive');
    const pair = await this.getSubmarinePair();
    if (amountSat < pair.limits.minimal || amountSat > pair.limits.maximal) {
      throw new BoltzLimitError(pair.limits.minimal, pair.limits.maximal);
    }

    const { bolt11 } = await this.lnbits.createInvoice(amountSat, 'Boltz on-chain deposit');
    const keyIndex = this.nextKeyIndex();

    return this.withMnemonic((mnemonic) => {
      const { publicKey } = deriveSwapKeyPair(mnemonic, keyIndex);
      const publicKeyHex = hex.encode(publicKey);
      const req: CreateSubmarineSwapRequest = {
        from: this.cfg.pair.from,
        to: this.cfg.pair.to,
        invoice: bolt11,
        refundPublicKey: publicKeyHex,
        pairHash: pair.hash,
        referralId: this.cfg.referralId,
      };
      return this.client.createSubmarineSwap(req).then(async (res) => {
        await this.createPersistedSwap(
          'submarine',
          res.id,
          this.cfg.pair.from,
          keyIndex,
          publicKeyHex,
          res.claimPublicKey,
          '', // preimageHash unknown for submarine; not needed for recovery
          res.swapTree,
          res.address,
          res.timeoutBlockHeight,
          { invoice: bolt11, expectedAmount: res.expectedAmount },
        );
        return { address: res.address, swapId: res.id };
      });
    });
  }

  /** Send Lightning sats to an on-chain address (reverse swap). */
  async swapOut(
    destinationAddress: string,
    amountSat: number,
    feeRate = DEFAULT_FEE_RATE,
    onProgress?: (step: 'creating' | 'payingHold' | 'awaitingLockup' | 'claiming' | 'broadcasting' | 'done') => void,
  ): Promise<{ txid: string }> {
    if (amountSat <= 0) throw new Error('amount must be positive');
    const pair = await this.getReversePair();
    if (amountSat < pair.limits.minimal || amountSat > pair.limits.maximal) {
      throw new BoltzLimitError(pair.limits.minimal, pair.limits.maximal);
    }

    const keyIndex = this.nextKeyIndex();
    return this.withMnemonic(async (mnemonic) => {
      const { privateKey, publicKey } = deriveSwapKeyPair(mnemonic, keyIndex);
      const publicKeyHex = hex.encode(publicKey);
      const preimage = deriveSwapPreimage(mnemonic, keyIndex);
      const preimageHash = hashPreimage(preimage);
      const preimageHashHex = hex.encode(preimageHash);

      const req: CreateReverseSwapRequest = {
        from: this.cfg.pair.from,
        to: this.cfg.pair.to,
        preimageHash: preimageHashHex,
        claimPublicKey: publicKeyHex,
        invoiceAmount: amountSat,
        pairHash: pair.hash,
        referralId: this.cfg.referralId,
      };
      const res = await this.client.createReverseSwap(req);
      await this.createPersistedSwap(
        'reverse',
        res.id,
        this.cfg.pair.to,
        keyIndex,
        publicKeyHex,
        res.refundPublicKey,
        preimageHashHex,
        res.swapTree,
        res.lockupAddress,
        res.timeoutBlockHeight,
        { invoice: res.invoice, onchainAmount: res.onchainAmount, destinationAddress },
      );

      // Pay the Boltz hold invoice immediately to lock the on-chain funds.
      onProgress?.('payingHold');
      await this.lnbits.payInvoice(res.invoice);

      // Wait for Boltz to broadcast the lockup tx, then claim cooperatively.
      onProgress?.('awaitingLockup');
      return this.waitAndClaimReverseSwap(res.id, destinationAddress, feeRate, onProgress);
    });
  }

  private async waitAndClaimReverseSwap(
    swapId: string,
    destinationAddress: string,
    feeRate: number,
    onProgress?: (step: 'creating' | 'payingHold' | 'awaitingLockup' | 'claiming' | 'broadcasting' | 'done') => void,
    maxAttempts = 40,
  ): Promise<{ txid: string }> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.client.getSwapStatus(swapId);
      await this.handleStatusUpdate(repository.getSwap(swapId)!, status.status);
      if (status.status === 'transaction.mempool' || status.status === 'transaction.confirmed') {
        onProgress?.('claiming');
        return this.claimReverseSwap(swapId, destinationAddress, feeRate, onProgress);
      }
      if (
        status.status === 'swap.expired' ||
        status.status === 'invoice.expired' ||
        status.status === 'invoice.failedToPay' ||
        status.status === 'transaction.lockupFailed'
      ) {
        throw new Error(`reverse swap failed: ${status.status}`);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('reverse swap lockup timeout');
  }

  /** Poll Boltz for a swap and drive it to completion. Returns a wallet PaymentStatus. */
  async reconcileSwap(id: string): Promise<'pending' | 'settled' | 'failed' | 'expired'> {
    const swap = repository.getSwap(id);
    if (!swap) throw new Error('unknown swap');

    const status = await this.client.getSwapStatus(id);
    await this.handleStatusUpdate(swap, status.status);
    return this.mapToPaymentStatus(swap.status, swap.expiresAt);
  }

  /** Re-check any pending swaps on app launch (rescue key / restore). */
  async restorePendingSwaps(): Promise<void> {
    const pending = repository.listPendingSwaps();
    for (const swap of pending) {
      try {
        await this.reconcileSwap(swap.id);
      } catch {
        /* individual swap failures must not block others */
      }
    }
  }

  private mapToPaymentStatus(status: BoltzStatus, expiresAt: number): 'pending' | 'settled' | 'failed' | 'expired' {
    if (status === 'invoice.settled' || status === 'transaction.claimed') return 'settled';
    if (status === 'swap.expired' || status === 'invoice.expired') return 'expired';
    if (status === 'invoice.failedToPay' || status === 'transaction.refunded' || status === 'transaction.lockupFailed') {
      return 'failed';
    }
    if (Date.now() > expiresAt) return 'expired';
    return 'pending';
  }

  private async handleStatusUpdate(swap: PersistedSwap, status: BoltzStatus): Promise<void> {
    if (swap.status === status) return;
    repository.updateSwapStatus(swap.id, status);
    swap.status = status;

    if (status === 'transaction.mempool' || status === 'transaction.confirmed') {
      const latest = await this.client.getSwapStatus(swap.id);
      if (latest.transaction?.id) {
        repository.updateSwapLockupTx(swap.id, latest.transaction.id);
        swap.lockupTxId = latest.transaction.id;
      }
      if (swap.direction === 'reverse' && !swap.claimTxId) {
        try {
          const feeRate = DEFAULT_FEE_RATE;
          const { txid } = await this.claimReverseSwap(swap.id, swap.destinationAddress ?? '', feeRate);
          repository.updateSwapClaimTx(swap.id, txid);
        } catch {
          /* will retry on next poll */
        }
      }
    }

    if (status === 'transaction.claim.pending' && swap.direction === 'submarine') {
      // Help Boltz claim the on-chain HTLC cooperatively.
      await this.cooperateSubmarineClaim(swap);
    }
  }

  private async claimReverseSwap(
    swapId: string,
    destinationAddress: string,
    feeRate: number,
    onProgress?: (step: 'creating' | 'payingHold' | 'awaitingLockup' | 'claiming' | 'broadcasting' | 'done') => void,
  ): Promise<{ txid: string }> {
    const swap = repository.getSwap(swapId);
    if (!swap || swap.direction !== 'reverse') throw new Error('not a reverse swap');

    const latest = await this.client.getSwapStatus(swapId);
    if (!latest.transaction?.hex) throw new Error('lockup transaction not available yet');

    return this.withMnemonic(async (mnemonic) => {
      const { privateKey } = deriveSwapKeyPair(mnemonic, swap.keyIndex);
      const preimage = deriveSwapPreimage(mnemonic, swap.keyIndex);
      const boltzPubkey = hex.decode(swap.theirPublicKey);
      const coreTree = deserializeSwapTree(swap.swapTree);
      const tweakedKey = tweakMusigAggregateKey(privateKey, boltzPubkey, coreTree);

      if (!latest.transaction?.hex) throw new Error('lockup transaction not available yet');
      const lockupTx = Transaction.fromRaw(hex.decode(latest.transaction.hex));
      const output = detectSwapOutput(tweakedKey, lockupTx);
      if (!output) throw new Error('swap output not found in lockup transaction');

      const network = boltzNetworkName(this.cfg.network);
      const destinationScript = toOutputScript(destinationAddress, network);
      const tx = buildCooperativeClaimTransaction(
        [
          {
            transactionId: latest.transaction.id!,
            vout: output.vout,
            script: output.script,
            amount: output.amount,
            privateKey,
            preimage,
            swapTree: coreTree,
          } satisfies ClaimTxInput,
        ],
        destinationScript,
        feeRate,
        swap.timeoutBlockHeight,
      );

      // Compute the sighash for the key-path spend and generate our nonce.
      onProgress?.('claiming');
      const sighash = tx.preimageWitnessV1(0, [output.script], SigHash.DEFAULT, [output.amount]);
      const ourNonce = generateOurNonce(privateKey, boltzPubkey, coreTree, sighash);

      const sig = await this.client.getReverseClaimSignature(swapId, {
        index: 0,
        transaction: hex.encode(tx.extract()),
        preimage: hex.encode(preimage),
        pubNonce: hex.encode(ourNonce.public),
      });

      const session = createMuSig2Session(
        privateKey,
        boltzPubkey,
        coreTree,
        hex.decode(sig.pubNonce),
        ourNonce,
        sighash,
      );
      session.addBoltzPartial(hex.decode(sig.partialSignature));
      const finalWitness = session.aggregatePartials();

      tx.updateInput(0, { finalScriptWitness: [finalWitness] });
      onProgress?.('broadcasting');
      const broadcasted = await this.client.broadcastTransaction(this.cfg.pair.to, hex.encode(tx.extract()));
      repository.updateSwapClaimTx(swapId, broadcasted.id);
      repository.updateSwapStatus(swapId, 'transaction.claimed');
      onProgress?.('done');
      return { txid: broadcasted.id };
    });
  }

  private async cooperateSubmarineClaim(swap: PersistedSwap): Promise<void> {
    // For submarine swaps we help Boltz claim on-chain with a partial signature.
    const details = await this.client.getSubmarineClaimDetails(swap.id);
    await this.withMnemonic(async (mnemonic) => {
      const { privateKey } = deriveSwapKeyPair(mnemonic, swap.keyIndex);
      const boltzPubkey = hex.decode(swap.theirPublicKey);
      const coreTree = deserializeSwapTree(swap.swapTree);
      const sighash = hex.decode(details.transactionHash);
      const ourNonce = generateOurNonce(privateKey, boltzPubkey, coreTree, sighash);
      const session = createMuSig2Session(
        privateKey,
        boltzPubkey,
        coreTree,
        hex.decode(details.pubNonce),
        ourNonce,
        sighash,
      );
      const partialSig = session.ourPartialSign();
      await this.client.postSubmarineClaimSignature(swap.id, {
        pubNonce: hex.encode(ourNonce.public),
        partialSignature: hex.encode(partialSig),
      });
    });
  }

}
