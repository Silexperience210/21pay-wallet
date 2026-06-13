import { hex } from '@scure/base';
import { p2tr, Script, Transaction } from '@scure/btc-signer';
import { swapTree as createSwapTree } from 'boltz-core';
import {
  deriveSwapKeyPair,
  deriveSwapPreimage,
  hashPreimage,
  toOutputScript,
  tweakMusigAggregateKey,
  deserializeSwapTree,
  detectSwapOutput,
  buildRefundTransaction,
} from './crypto';
import type { SwapTree } from './types';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('Boltz crypto helpers', () => {
  it('derives deterministic swap keys from mnemonic + index', () => {
    const a = deriveSwapKeyPair(TEST_MNEMONIC, 0);
    const b = deriveSwapKeyPair(TEST_MNEMONIC, 0);
    const c = deriveSwapKeyPair(TEST_MNEMONIC, 1);
    expect(hex.encode(a.privateKey)).toBe(hex.encode(b.privateKey));
    expect(hex.encode(a.publicKey)).toBe(hex.encode(b.publicKey));
    expect(hex.encode(a.privateKey)).not.toBe(hex.encode(c.privateKey));
    expect(a.publicKey.length).toBe(33);
  });

  it('derives deterministic 32-byte preimages from mnemonic + index', () => {
    const a = deriveSwapPreimage(TEST_MNEMONIC, 0);
    const b = deriveSwapPreimage(TEST_MNEMONIC, 0);
    const c = deriveSwapPreimage(TEST_MNEMONIC, 1);
    expect(a.length).toBe(32);
    expect(hex.encode(a)).toBe(hex.encode(b));
    expect(hex.encode(a)).not.toBe(hex.encode(c));
  });

  it('hashes preimages with sha256', () => {
    const preimage = deriveSwapPreimage(TEST_MNEMONIC, 0);
    const hash = hashPreimage(preimage);
    expect(hash.length).toBe(32);
  });

  it('decodes a mainnet taproot address to output script', () => {
    const { address } = p2tr(new Uint8Array(32).fill(1), undefined, {
      bech32: 'bc',
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80,
    }) as { address?: string };
    if (!address) throw new Error('could not generate test address');
    const script = toOutputScript(address, 'bitcoin');
    expect(script.length).toBeGreaterThan(0);
  });

  it('decodes a regtest taproot address to output script', () => {
    const { address } = p2tr(new Uint8Array(32).fill(2), undefined, {
      bech32: 'bcrt',
      pubKeyHash: 0x6f,
      scriptHash: 0xc4,
      wif: 0xef,
    }) as { address?: string };
    if (!address) throw new Error('could not generate test address');
    const script = toOutputScript(address, 'regtest');
    expect(script.length).toBeGreaterThan(0);
  });

  it('deserializes a Boltz swap tree', () => {
    const tree: SwapTree = {
      claimLeaf: {
        version: 192,
        output: hex.encode(new Uint8Array([0x51])),
      },
      refundLeaf: {
        version: 192,
        output: hex.encode(new Uint8Array([0x00])),
      },
    };
    const core = deserializeSwapTree(tree);
    expect(core.claimLeaf.output).toBeInstanceOf(Uint8Array);
    expect(core.refundLeaf.output).toBeInstanceOf(Uint8Array);
    expect(core.tree).toBeDefined();
  });

  it('builds a non-cooperative submarine refund transaction', () => {
    const { privateKey: refundPriv, publicKey: refundPub } = deriveSwapKeyPair(TEST_MNEMONIC, 0);
    const { publicKey: claimPub } = deriveSwapKeyPair(TEST_MNEMONIC, 999);
    const preimage = deriveSwapPreimage(TEST_MNEMONIC, 0);
    const coreTree = createSwapTree(false, hashPreimage(preimage), claimPub, refundPub, 100) as any;
    const deserialized = deserializeSwapTree({
      claimLeaf: { version: coreTree.claimLeaf.version, output: hex.encode(coreTree.claimLeaf.output) },
      refundLeaf: { version: coreTree.refundLeaf.version, output: hex.encode(coreTree.refundLeaf.output) },
    });
    const tweakedKey = tweakMusigAggregateKey(refundPriv, claimPub, deserialized);

    const net = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
    const lockupScript = Script.encode(['OP_1', tweakedKey]);

    const lockupTx = new Transaction({ allowUnknownOutputs: true });
    lockupTx.addOutput({ script: lockupScript, amount: 100_000n });

    const output = detectSwapOutput(tweakedKey, lockupTx);
    expect(output).toBeDefined();

    const refundAddr = (p2tr(new Uint8Array(32).fill(9), undefined, net) as { address?: string }).address;
    if (!refundAddr) throw new Error('could not create refund address');
    const refundScript = toOutputScript(refundAddr, 'regtest');

    const tx = buildRefundTransaction(
      {
        transactionId: lockupTx.id,
        vout: output!.vout,
        script: output!.script,
        amount: output!.amount,
        privateKey: refundPriv,
        swapTree: deserialized,
        internalKey: tweakedKey,
      },
      refundScript,
      1,
      100,
    );

    expect(tx.inputsLength).toBe(1);
    expect(tx.outputsLength).toBe(1);
  });

  it('tweaks the MuSig2 aggregate key with the swap tree', () => {
    const { privateKey } = deriveSwapKeyPair(TEST_MNEMONIC, 0);
    const { publicKey: boltzPub } = deriveSwapKeyPair(TEST_MNEMONIC, 999);
    const tree: SwapTree = {
      claimLeaf: {
        version: 192,
        output: hex.encode(new Uint8Array([0x51])),
      },
      refundLeaf: {
        version: 192,
        output: hex.encode(new Uint8Array([0x00])),
      },
    };
    const coreTree = deserializeSwapTree(tree);
    const tweaked = tweakMusigAggregateKey(privateKey, boltzPub, coreTree);
    expect(tweaked.length).toBe(32);
  });
});
