/**
 * Boltz service integration tests against an in-process mock Boltz API server.
 * The server and client share deterministic test mnemonics so the cooperative
 * MuSig2 flows can be exercised end-to-end without a live Boltz backend.
 */
import http from 'http';
import { hex } from '@scure/base';
import { Transaction, Script, p2tr } from '@scure/btc-signer';
import { hash160 } from '@scure/btc-signer/utils.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { swapTree as createSwapTree } from 'boltz-core';
import { BoltzSwapService } from './service';
import * as repository from './repository';
import { loadBoltzConfig, type BoltzConfig } from './config';
import {
  deriveSwapKeyPair,
  deriveSwapPreimage,
  hashPreimage,
  tweakMusigAggregateKey,
  deserializeSwapTree,
  toOutputScript,
  detectSwapOutput,
  buildRefundTransaction,
  generateOurNonce,
  createMuSig2Session,
  type RefundTxInput,
} from './crypto';
import type { SwapTree } from './types';

const CLIENT_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const BOLTZ_MNEMONIC =
  'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';

jest.mock('@/core/keys', () => ({
  loadMnemonic: jest.fn().mockResolvedValue(CLIENT_MNEMONIC),
}));

const mockSwaps = new Map<string, any>();
jest.mock('./repository', () => ({
  upsertSwap: jest.fn((s) => mockSwaps.set(s.id, { ...mockSwaps.get(s.id), ...s })),
  getSwap: jest.fn((id) => mockSwaps.get(id)),
  updateSwapStatus: jest.fn((id, status) => {
    const s = mockSwaps.get(id);
    if (s) s.status = status;
  }),
  updateSwapLockupTx: jest.fn((id, txId) => {
    const s = mockSwaps.get(id);
    if (s) s.lockupTxId = txId;
  }),
  updateSwapClaimTx: jest.fn((id, txId) => {
    const s = mockSwaps.get(id);
    if (s) s.claimTxId = txId;
  }),
  markSwapRefunded: jest.fn((id) => {
    const s = mockSwaps.get(id);
    if (s) s.refunded = true;
  }),
  listSwaps: jest.fn().mockReturnValue([]),
  listPendingSwaps: jest.fn().mockReturnValue([]),
}));

interface MockSubmarineSwap {
  id: string;
  invoice: string;
  refundPublicKey: Uint8Array;
  claimPublicKey: Uint8Array;
  swapTree: SwapTree;
  timeoutBlockHeight: number;
  expectedAmount: number;
  status: string;
  lockupTxHex?: string;
}

interface MockReverseSwap {
  id: string;
  invoice: string;
  claimPublicKey: Uint8Array;
  refundPublicKey: Uint8Array;
  swapTree: SwapTree;
  timeoutBlockHeight: number;
  onchainAmount: number;
  status: string;
  lockupTxHex?: string;
  lockupTxId?: string;
  preimageHash: Uint8Array;
}

function makeLnbitsMock() {
  return {
    createInvoice: jest.fn().mockResolvedValue({ bolt11: 'lnbc...invoice', paymentHash: 'ph' }),
    payInvoice: jest.fn().mockResolvedValue({ preimage: 'preimage', feeSat: 0 }),
  };
}

async function buildDummyLockupTx(lockupScript: Uint8Array): Promise<string> {
  const dummyPriv = new Uint8Array(32).fill(1);
  const dummyPub = secp256k1.getPublicKey(dummyPriv, true);
  const p2wpkhScript = Script.encode(['OP_0', hash160(dummyPub)]);
  const tx = new Transaction({ allowUnknownInputs: true, allowUnknownOutputs: true, disableScriptCheck: true });
  tx.addInput({ txid: '00'.repeat(32), index: 0, witnessUtxo: { script: p2wpkhScript, amount: 100_000n } });
  tx.addOutput({ script: lockupScript, amount: 100_000n });
  await Promise.resolve(tx.sign(dummyPriv));
  tx.finalize();
  return hex.encode(tx.extract());
}

async function startMockBoltzServer(): Promise<{ url: string; stop: () => Promise<void>; submarine: Map<string, MockSubmarineSwap>; reverse: Map<string, MockReverseSwap> }> {
  const submarine = new Map<string, MockSubmarineSwap>();
  const reverse = new Map<string, MockReverseSwap>();

  const server = http.createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const readBody = async (): Promise<unknown> => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      return raw ? JSON.parse(raw) : {};
    };

    void (async () => {
      const url = req.url ?? '';
      try {
        if (url === '/swap/submarine' && req.method === 'GET') {
          send(200, {
            BTC: {
              BTC: {
                hash: 'submarine-hash',
                rate: 1,
                limits: { minimal: 50000, maximal: 25000000, maximalZeroConf: 0 },
                fees: { percentage: 0.1, minerFees: 4379 },
              },
            },
          });
          return;
        }
        if (url === '/swap/reverse' && req.method === 'GET') {
          send(200, {
            BTC: {
              BTC: {
                hash: 'reverse-hash',
                rate: 1,
                limits: { minimal: 50000, maximal: 25000000 },
                fees: { percentage: 0.5, minerFees: { lockup: 2, claim: 1998 } },
              },
            },
          });
          return;
        }
        if (url === '/swap/submarine' && req.method === 'POST') {
          const body = (await readBody()) as { invoice: string; refundPublicKey: string };
          const id = `sub-${submarine.size + 1}`;
          const { publicKey: claimPub } = deriveSwapKeyPair(BOLTZ_MNEMONIC, submarine.size);
          const refundPub = hex.decode(body.refundPublicKey);
          const tree = createSwapTree(false, new Uint8Array(32).fill(0), claimPub, refundPub, 100) as any;
          const serialized: SwapTree = {
            claimLeaf: { version: tree.claimLeaf.version, output: hex.encode(tree.claimLeaf.output) },
            refundLeaf: { version: tree.refundLeaf.version, output: hex.encode(tree.refundLeaf.output) },
          };
          const coreTree = deserializeSwapTree(serialized);
          const tweakedKey = tweakMusigAggregateKey(deriveSwapKeyPair(BOLTZ_MNEMONIC, submarine.size).privateKey, refundPub, coreTree);
          const net = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
          const address = (p2tr(tweakedKey, undefined, net) as { address?: string }).address!;
          const swap: MockSubmarineSwap = {
            id,
            invoice: body.invoice,
            refundPublicKey: refundPub,
            claimPublicKey: claimPub,
            swapTree: serialized,
            timeoutBlockHeight: 100,
            expectedAmount: 100000,
            status: 'swap.created',
          };
          submarine.set(id, swap);
          send(201, {
            id,
            address,
            claimPublicKey: hex.encode(claimPub),
            swapTree: serialized,
            timeoutBlockHeight: 100,
            expectedAmount: 100000,
          });
          return;
        }
        if (url === '/swap/reverse' && req.method === 'POST') {
          const body = (await readBody()) as { preimageHash: string; claimPublicKey: string; invoiceAmount: number };
          const id = `rev-${reverse.size + 1}`;
          const { privateKey: refundPriv, publicKey: refundPub } = deriveSwapKeyPair(BOLTZ_MNEMONIC, reverse.size);
          const claimPub = hex.decode(body.claimPublicKey);
          const preimageHash = hex.decode(body.preimageHash);
          const tree = createSwapTree(false, preimageHash, claimPub, refundPub, 100) as any;
          const serialized: SwapTree = {
            claimLeaf: { version: tree.claimLeaf.version, output: hex.encode(tree.claimLeaf.output) },
            refundLeaf: { version: tree.refundLeaf.version, output: hex.encode(tree.refundLeaf.output) },
          };
          const coreTree = deserializeSwapTree(serialized);
          const tweakedKey = tweakMusigAggregateKey(refundPriv, claimPub, coreTree);
          const net = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
          const lockupAddress = (p2tr(tweakedKey, undefined, net) as { address?: string }).address!;
          const lockupTxHex = await buildDummyLockupTx(Script.encode(['OP_1', tweakedKey]));
          const lockupTxId = Transaction.fromRaw(hex.decode(lockupTxHex), { allowUnknownOutputs: true }).id;
          const swap: MockReverseSwap = {
            id,
            invoice: `lnbc...hold-${id}`,
            claimPublicKey: claimPub,
            refundPublicKey: refundPub,
            swapTree: serialized,
            timeoutBlockHeight: 100,
            onchainAmount: body.invoiceAmount - 1000,
            status: 'transaction.mempool',
            lockupTxHex,
            lockupTxId,
            preimageHash,
          };
          reverse.set(id, swap);
          send(201, {
            id,
            invoice: swap.invoice,
            swapTree: serialized,
            lockupAddress,
            refundPublicKey: hex.encode(refundPub),
            timeoutBlockHeight: 100,
            onchainAmount: swap.onchainAmount,
          });
          return;
        }
        const statusMatch = url.match(/^\/swap\/status\/([^/]+)$/);
        if (statusMatch && req.method === 'GET') {
          const id = statusMatch[1];
          const sub = submarine.get(id);
          const rev = reverse.get(id);
          const swap = sub ?? rev;
          if (!swap) return send(404, { error: 'not found' });
          // Auto-expire reverse swaps quickly so tests don't wait 2 minutes.
          if (rev && swap.status === 'swap.created' && !('_statusCalls' in rev)) (rev as any)._statusCalls = 0;
          if (rev && swap.status === 'swap.created' && (rev as any)._statusCalls++ > 1) swap.status = 'swap.expired';
          send(200, { status: swap.status, transaction: swap.lockupTxHex ? { hex: swap.lockupTxHex, id: (swap as any).lockupTxId } : undefined });
          return;
        }
        const subRefundMatch = url.match(/^\/swap\/submarine\/([^/]+)\/refund$/);
        if (subRefundMatch && req.method === 'POST') {
          const id = subRefundMatch[1];
          const swap = submarine.get(id);
          if (!swap) return send(404, { error: 'not found' });
          const body = (await readBody()) as { transaction: string; pubNonce: string; index: number };
          const { privateKey: boltzPriv } = deriveSwapKeyPair(BOLTZ_MNEMONIC, Number(id.split('-')[1]) - 1);
          const clientPub = swap.refundPublicKey;
          const coreTree = deserializeSwapTree(swap.swapTree);
          const tx = Transaction.fromRaw(hex.decode(body.transaction));
          const boltzPub = swap.claimPublicKey;
          const tweakedKey = tweakMusigAggregateKey(boltzPriv, clientPub, coreTree);
          const output = detectSwapOutput(tweakedKey, tx);
          if (!output) return send(400, { error: 'no swap output' });
          const sighash = tx.preimageWitnessV1(body.index, [output.script], 0x01, [output.amount]);
          const clientNonce = hex.decode(body.pubNonce);
          const ourNonce = generateOurNonce(boltzPriv, clientPub, coreTree, sighash);
          const session = createMuSig2Session(boltzPriv, clientPub, coreTree, clientNonce, ourNonce, sighash);
          const partialSig = session.ourPartialSign();
          send(200, { pubNonce: hex.encode(ourNonce.public), partialSignature: hex.encode(partialSig) });
          return;
        }
        const reverseClaimMatch = url.match(/^\/swap\/reverse\/([^/]+)\/claim$/);
        if (reverseClaimMatch && req.method === 'POST') {
          const id = reverseClaimMatch[1];
          const swap = reverse.get(id);
          if (!swap) return send(404, { error: 'not found' });
          if (!swap.lockupTxHex) return send(400, { error: 'lockup tx not available' });
          const body = (await readBody()) as { transaction: string; preimage: string; pubNonce: string; index: number };
          const { privateKey: refundPriv } = deriveSwapKeyPair(BOLTZ_MNEMONIC, Number(id.split('-')[1]) - 1);
          const claimPub = swap.claimPublicKey;
          const coreTree = deserializeSwapTree(swap.swapTree);
          const claimTx = Transaction.fromRaw(hex.decode(body.transaction), { allowUnknownOutputs: true, allowUnknownInputs: true });
          const lockupTx = Transaction.fromRaw(hex.decode(swap.lockupTxHex), { allowUnknownOutputs: true });
          const lockupOut = (lockupTx as any).outputs[0];
          if (!lockupOut) return send(400, { error: 'lockup output missing' });
          const input = (claimTx as any).inputs[body.index];
          const inputTxid = input?.txid instanceof Uint8Array ? hex.encode(input.txid) : input?.txid;
          if (!input || inputTxid !== swap.lockupTxId || Number(input.index) !== 0) {
            return send(400, { error: 'no swap output' });
          }
          const sighash = claimTx.preimageWitnessV1(body.index, [lockupOut.script], 0x01, [lockupOut.amount]);
          const clientNonce = hex.decode(body.pubNonce);
          const ourNonce = generateOurNonce(refundPriv, claimPub, coreTree, sighash);
          const session = createMuSig2Session(refundPriv, claimPub, coreTree, clientNonce, ourNonce, sighash);
          const partialSig = session.ourPartialSign();
          send(200, { pubNonce: hex.encode(ourNonce.public), partialSignature: hex.encode(partialSig) });
          return;
        }
        const broadcastMatch = url.match(/^\/chain\/BTC\/transaction$/);
        if (broadcastMatch && req.method === 'POST') {
          const body = (await readBody()) as { hex: string };
          send(201, { id: Transaction.fromRaw(hex.decode(body.hex), { allowUnknownOutputs: true }).id });
          return;
        }
        send(404, { error: 'not found' });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('mock server error', url, e);
        send(500, { error: String(e) });
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return {
    url: `http://127.0.0.1:${(server.address() as any).port}`,
    stop: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
    submarine,
    reverse,
  };
}

describe('BoltzSwapService integration', () => {
  let mock: Awaited<ReturnType<typeof startMockBoltzServer>>;
  let cfg: BoltzConfig;

  beforeEach(async () => {
    mockSwaps.clear();
    mock = await startMockBoltzServer();
    cfg = { ...loadBoltzConfig(), apiUrl: mock.url, network: 'regtest', pair: { from: 'BTC', to: 'BTC' } };
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await mock.stop();
  });

  it('creates a submarine swap via the mock server', async () => {
    const lnbits = makeLnbitsMock() as any;
    const service = new BoltzSwapService(cfg, lnbits);
    await service.initialize();

    const { address, swapId } = await service.getDepositAddress(100000);
    expect(address).toMatch(/^bcrt1/);
    expect(swapId).toMatch(/^sub-/);
    expect(lnbits.createInvoice).toHaveBeenCalledWith(100000, 'Boltz on-chain deposit');
  });

  it('refunds an expired submarine swap cooperatively', async () => {
    const lnbits = makeLnbitsMock() as any;
    const service = new BoltzSwapService(cfg, lnbits);
    await service.initialize();

    const { address, swapId } = await service.getDepositAddress(100000);
    const swap = mock.submarine.get(swapId)!;
    swap.status = 'swap.expired';
    const persisted = repository.getSwap(swapId) as any;
    if (persisted) persisted.status = 'swap.expired';

    // Build a fake lockup tx that pays the swap address.
    const { privateKey: refundPriv } = deriveSwapKeyPair(CLIENT_MNEMONIC, 0);
    const { publicKey: claimPub } = deriveSwapKeyPair(BOLTZ_MNEMONIC, 0);
    const coreTree = deserializeSwapTree(swap.swapTree);
    const tweakedKey = tweakMusigAggregateKey(refundPriv, claimPub, coreTree);
    const net = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
    swap.lockupTxHex = await buildDummyLockupTx(Script.encode(['OP_1', tweakedKey]));

    const refundAddress = (p2tr(secp256k1.getPublicKey(new Uint8Array(32).fill(2), true).slice(1), undefined, net) as { address?: string }).address!;

    const { txid } = await service.refundSubmarineSwap(swapId, refundAddress);
    expect(txid).toBeDefined();
    expect(repository.markSwapRefunded).toHaveBeenCalledWith(swapId);
  });

  it('creates a reverse swap and claims the lockup transaction', async () => {
    const lnbits = makeLnbitsMock() as any;
    const service = new BoltzSwapService(cfg, lnbits);
    await service.initialize();

    const net = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };
    const destinationAddress = (
      p2tr(secp256k1.getPublicKey(new Uint8Array(32).fill(3), true).slice(1), undefined, net) as {
        address?: string;
      }
    ).address!;

    const progress = jest.fn();
    const { txid } = await service.swapOut(destinationAddress, 100000, undefined, progress);
    expect(txid).toBeDefined();
    expect(lnbits.payInvoice).toHaveBeenCalledWith('lnbc...hold-rev-1');
    expect(progress).toHaveBeenCalledWith('done');
  });
});
