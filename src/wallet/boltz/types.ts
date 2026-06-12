// Boltz swap domain types. These mirror the relevant parts of Boltz API v2.
// Pure types only — no IO or secrets.

export type SwapAsset = 'BTC' | 'L-BTC';
export type SwapDirection = 'submarine' | 'reverse';

export type BoltzStatus =
  | 'swap.created'
  | 'swap.expired'
  | 'invoice.set'
  | 'invoice.settled'
  | 'invoice.failedToPay'
  | 'invoice.expired'
  | 'transaction.mempool'
  | 'transaction.confirmed'
  | 'transaction.claimed'
  | 'transaction.refunded'
  | 'transaction.claim.pending'
  | 'transaction.lockupFailed'
  | 'transaction.server.mempool'
  | 'transaction.server.confirmed'
  | string;

export interface SwapTreeLeaf {
  version: number;
  output: string; // hex-encoded script
}

export interface SwapTree {
  claimLeaf: SwapTreeLeaf;
  refundLeaf: SwapTreeLeaf;
  covenantClaimLeaf?: SwapTreeLeaf;
}

export interface SwapLimits {
  minimal: number;
  maximal: number;
  maximalZeroConf?: number;
  minimalBatched?: number;
}

export interface ReverseMinerFees {
  lockup: number;
  claim: number;
}

export interface SubmarineMinerFees {
  minerFees: number;
}

export interface ReversePair {
  hash: string;
  rate: number;
  limits: SwapLimits;
  fees: {
    percentage: number;
    minerFees: ReverseMinerFees;
  };
}

export interface SubmarinePair {
  hash: string;
  rate: number;
  limits: SwapLimits;
  fees: {
    percentage: number;
    minerFees: number;
  };
}

export interface CreateReverseSwapRequest {
  from: SwapAsset;
  to: SwapAsset;
  preimageHash: string; // hex sha256
  claimPublicKey: string; // hex compressed pubkey
  invoiceAmount: number;
  pairHash?: string;
  referralId?: string;
}

export interface CreateReverseSwapResponse {
  id: string;
  invoice: string; // hold invoice to pay
  swapTree: SwapTree;
  lockupAddress: string;
  refundPublicKey: string; // Boltz pubkey
  timeoutBlockHeight: number;
  onchainAmount: number;
  referralId?: string;
}

export interface CreateSubmarineSwapRequest {
  from: SwapAsset;
  to: SwapAsset;
  invoice: string; // BOLT11 we want Boltz to pay
  refundPublicKey: string; // our pubkey
  pairHash?: string;
  referralId?: string;
}

export interface CreateSubmarineSwapResponse {
  id: string;
  bip21?: string;
  address: string; // on-chain HTLC address to present to the payer
  swapTree: SwapTree;
  claimPublicKey: string; // Boltz pubkey
  timeoutBlockHeight: number;
  expectedAmount: number;
  acceptZeroConf?: boolean;
  referralId?: string;
}

export interface SwapStatusResponse {
  status: BoltzStatus;
  zeroConfRejected?: boolean;
  transaction?: {
    id?: string;
    hex?: string;
    confirmed?: boolean;
  };
}

export interface ClaimSignatureRequest {
  index: number;
  transaction: string; // hex
  preimage: string; // hex
  pubNonce: string; // hex
}

export interface ClaimSignatureResponse {
  pubNonce: string; // hex
  partialSignature: string; // hex
}

export interface PartialSignature {
  pubNonce: string; // hex
  partialSignature: string; // hex
}

// Internal persisted swap record. Secrets (preimage, private key) are stored in the
// Vault under a namespaced key, NEVER in SQLite. This record holds public metadata only.
export interface PersistedSwap {
  id: string;
  direction: SwapDirection;
  asset: SwapAsset;
  status: BoltzStatus;
  createdAt: number;
  expiresAt: number;
  keyIndex: number;
  ourPublicKey: string; // hex
  theirPublicKey: string; // hex Boltz pubkey
  preimageHash: string; // hex
  swapTree: SwapTree;
  lockupAddress: string;
  timeoutBlockHeight: number;
  invoice?: string;
  expectedAmount?: number;
  onchainAmount?: number;
  destinationAddress?: string; // for reverse swaps
  lockupTxId?: string;
  claimTxId?: string;
  refunded: boolean;
}

export interface SwapQuote {
  pairHash: string;
  percentage: number;
  minerFees: number;
  min: number;
  max: number;
  feeSat: number;
}

export interface ReverseSwapQuote extends Omit<SwapQuote, 'minerFees'> {
  minerFees: ReverseMinerFees;
}

export interface SubmarineSwapQuote extends Omit<SwapQuote, 'minerFees'> {
  minerFees: number;
  maximalZeroConf: number;
}
