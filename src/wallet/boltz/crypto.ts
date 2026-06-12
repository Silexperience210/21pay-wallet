// Boltz cryptographic helpers. Swap keys are derived from the BIP39 mnemonic so
// they are recoverable, but they are NEVER persisted outside the Vault boundary.
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { expand as hkdfExpand } from '@noble/hashes/hkdf.js';
import { schnorr, secp256k1 } from '@noble/curves/secp256k1.js';
import * as btcSignerMusig from '@scure/btc-signer/musig2.js';
import { Transaction, Address, OutScript } from '@scure/btc-signer';
import {
  detectSwap,
  OutputType,
  SwapTreeSerializer,
  TaprootUtils,
  constructClaimTransaction as boltzConstructClaimTransaction,
  targetFee as boltzTargetFee,
} from 'boltz-core';
type BoltzCoreSwapTree = ReturnType<typeof SwapTreeSerializer.deserializeSwapTree>;
import type { SwapTree } from './types';

const BOLTZ_DERIVATION_PATH = "m/44'/0'/0'/1";

export function deriveSwapKeyPair(mnemonic: string, index: number): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const seed = mnemonicToSeedSync(mnemonic);
  const node = HDKey.fromMasterSeed(seed).derive(`${BOLTZ_DERIVATION_PATH}/${index}`);
  if (!node.privateKey) throw new Error('could not derive swap key');
  const publicKey = secp256k1.getPublicKey(node.privateKey, true); // compressed
  return { privateKey: node.privateKey, publicKey };
}

export function deriveSwapPreimage(mnemonic: string, index: number): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic);
  return hkdfExpand(sha256, seed, new TextEncoder().encode(`${index}`), 32);
}

export function hashPreimage(preimage: Uint8Array): Uint8Array {
  return sha256(preimage);
}

export function deserializeSwapTree(tree: SwapTree): BoltzCoreSwapTree {
  // Boltz's serializer accepts a JSON shape with hex strings; cast through unknown
  // because the public types also accept the parsed Uint8Array LiquidSwapTree shape.
  const serialized = {
    claimLeaf: { version: tree.claimLeaf.version, output: tree.claimLeaf.output },
    refundLeaf: { version: tree.refundLeaf.version, output: tree.refundLeaf.output },
    covenantClaimLeaf: tree.covenantClaimLeaf
      ? { version: tree.covenantClaimLeaf.version, output: tree.covenantClaimLeaf.output }
      : undefined,
  };
  return SwapTreeSerializer.deserializeSwapTree(serialized as any) as BoltzCoreSwapTree;
}

export function tweakMusigAggregateKey(
  ourPrivkey: Uint8Array,
  boltzPubkey: Uint8Array,
  swapTree: BoltzCoreSwapTree,
): Uint8Array {
  const ourPub = secp256k1.getPublicKey(ourPrivkey, true);
  const publicKeys = [boltzPubkey, ourPub].sort((a, b) => hex.encode(a).localeCompare(hex.encode(b)));
  const agg = btcSignerMusig.keyAggregate(publicKeys);
  const treeHash = TaprootUtils.taprootHashTree(swapTree.tree).hash;
  const tweaked = btcSignerMusig.keyAggregate(publicKeys, [treeHash], [true]);
  return btcSignerMusig.keyAggExport(tweaked);
}

export function detectSwapOutput(
  tweakedKey: Uint8Array,
  lockupTx: Transaction,
): { vout: number; script: Uint8Array; amount: bigint } | undefined {
  const out = detectSwap(tweakedKey, lockupTx);
  if (!out || out.script == null) return undefined;
  return {
    vout: out.vout,
    script: out.script,
    amount: BigInt((out as any).amount),
  };
}

export interface ClaimTxInput {
  transactionId: string;
  vout: number;
  script: Uint8Array;
  amount: bigint;
  privateKey: Uint8Array;
  preimage: Uint8Array;
  swapTree: BoltzCoreSwapTree;
}

export function buildCooperativeClaimTransaction(
  utxos: ClaimTxInput[],
  destinationScript: Uint8Array,
  feeSatPerVb: number,
  timeoutBlockHeight?: number,
): Transaction {
  // biome-ignore lint/suspicious/noExplicitAny: boltz-core types accept any-like shape
  const details = utxos.map((u) => ({
    ...u,
    type: OutputType.Taproot,
    cooperative: true,
    preimage: u.preimage,
  })) as any[];
  const tx = boltzTargetFee(feeSatPerVb, (fee) =>
    boltzConstructClaimTransaction(details, destinationScript, fee, true, timeoutBlockHeight, false),
  );
  return tx;
}

export function getSortedPublicKeys(ourPrivkey: Uint8Array, boltzPubkey: Uint8Array): Uint8Array[] {
  const ourPub = secp256k1.getPublicKey(ourPrivkey, true);
  return [boltzPubkey, ourPub].sort((a, b) => hex.encode(a).localeCompare(hex.encode(b)));
}

export function generateOurNonce(
  ourPrivkey: Uint8Array,
  boltzPubkey: Uint8Array,
  swapTree: BoltzCoreSwapTree,
  sighash: Uint8Array,
): { public: Uint8Array; secret: Uint8Array } {
  const ourPub = secp256k1.getPublicKey(ourPrivkey, true);
  const publicKeys = getSortedPublicKeys(ourPrivkey, boltzPubkey);
  const treeHash = TaprootUtils.taprootHashTree(swapTree.tree).hash;
  const aggPub = btcSignerMusig.keyAggExport(btcSignerMusig.keyAggregate(publicKeys, [treeHash], [true]));
  return btcSignerMusig.nonceGen(ourPub, ourPrivkey, aggPub, sighash, treeHash);
}

export function createMuSig2Session(
  ourPrivkey: Uint8Array,
  boltzPubkey: Uint8Array,
  swapTree: BoltzCoreSwapTree,
  boltzPubNonce: Uint8Array,
  ourNonce: { public: Uint8Array; secret: Uint8Array },
  sighash: Uint8Array,
): {
  aggregateNonce: Uint8Array;
  session: btcSignerMusig.Session;
  ourPartialSign(): Uint8Array;
  addBoltzPartial(partialSig: Uint8Array): void;
  aggregatePartials(): Uint8Array;
} {
  const publicKeys = getSortedPublicKeys(ourPrivkey, boltzPubkey);
  const treeHash = TaprootUtils.taprootHashTree(swapTree.tree).hash;
  const aggregateNonce = btcSignerMusig.nonceAggregate([boltzPubNonce, ourNonce.public]);
  const session = new btcSignerMusig.Session(aggregateNonce, publicKeys, sighash, [treeHash], [true]);

  let boltzPartialSig: Uint8Array | undefined;

  return {
    aggregateNonce,
    session,
    ourPartialSign: () => session.sign(ourNonce.secret, ourPrivkey, true),
    addBoltzPartial: (partialSig: Uint8Array) => {
      boltzPartialSig = partialSig;
      const ourIdx = publicKeys.findIndex((pk) => hex.encode(pk) === hex.encode(secp256k1.getPublicKey(ourPrivkey, true)));
      const boltzIdx = ourIdx === 0 ? 1 : 0;
      session.partialSigVerify(partialSig, [boltzPubNonce, ourNonce.public], boltzIdx);
    },
    aggregatePartials: () => {
      if (!boltzPartialSig) throw new Error('missing Boltz partial signature');
      const ourSig = session.sign(ourNonce.secret, ourPrivkey, true);
      return session.partialSigAgg([boltzPartialSig, ourSig]);
    },
  };
}

export function toOutputScript(address: string, network: 'bitcoin' | 'regtest'): Uint8Array {
  const net = networkFor(network);
  const decoded = Address(net).decode(address);
  if (!decoded) throw new Error(`unsupported or invalid address: ${address}`);
  return OutScript.encode(decoded);
}

export function validateOnchainAddress(address: string, network: 'bitcoin' | 'regtest'): boolean {
  try {
    const net = networkFor(network);
    const decoded = Address(net).decode(address);
    return decoded != null;
  } catch {
    return false;
  }
}

function networkFor(network: 'bitcoin' | 'regtest') {
  return network === 'regtest'
    ? { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
    : { bech32: 'bc', pubKeyHash: 0x00, scriptHash: 0x05, wif: 0x80 };
}
