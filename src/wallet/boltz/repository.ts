// Boltz swap persistence. NON-SECRET metadata only: the mnemonic-derived swap key
// and preimage are recomputed on demand from the Vault mnemonic + key_index.
import { openDatabaseSync } from 'expo-sqlite';
import type { BoltzStatus, PersistedSwap, SwapDirection, SwapAsset, SwapTree } from './types';

type DB = ReturnType<typeof openDatabaseSync>;
let db: DB | null = null;

export function openBoltzDb(): DB {
  if (!db) {
    db = openDatabaseSync('21pay.db');
    db.execSync(
      `CREATE TABLE IF NOT EXISTS boltz_swaps (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        asset TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        key_index INTEGER NOT NULL,
        our_public_key TEXT NOT NULL,
        their_public_key TEXT NOT NULL,
        preimage_hash TEXT NOT NULL,
        swap_tree TEXT NOT NULL,
        lockup_address TEXT NOT NULL,
        timeout_block_height INTEGER NOT NULL,
        invoice TEXT,
        expected_amount INTEGER,
        onchain_amount INTEGER,
        destination_address TEXT,
        lockup_tx_id TEXT,
        claim_tx_id TEXT,
        refunded INTEGER DEFAULT 0
      )`,
    );
    db.execSync(
      `CREATE INDEX IF NOT EXISTS idx_boltz_status ON boltz_swaps(status)`,
    );
  }
  return db;
}

function conn(): DB {
  return db ?? openBoltzDb();
}

function rowToSwap(r: any): PersistedSwap {
  return {
    id: r.id,
    direction: r.direction as SwapDirection,
    asset: r.asset as SwapAsset,
    status: r.status as BoltzStatus,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    keyIndex: r.key_index,
    ourPublicKey: r.our_public_key,
    theirPublicKey: r.their_public_key,
    preimageHash: r.preimage_hash,
    swapTree: JSON.parse(r.swap_tree) as SwapTree,
    lockupAddress: r.lockup_address,
    timeoutBlockHeight: r.timeout_block_height,
    invoice: r.invoice ?? undefined,
    expectedAmount: r.expected_amount ?? undefined,
    onchainAmount: r.onchain_amount ?? undefined,
    destinationAddress: r.destination_address ?? undefined,
    lockupTxId: r.lockup_tx_id ?? undefined,
    claimTxId: r.claim_tx_id ?? undefined,
    refunded: Boolean(r.refunded),
  };
}

export function upsertSwap(swap: PersistedSwap): void {
  conn().runSync(
    `INSERT OR REPLACE INTO boltz_swaps
       (id, direction, asset, status, created_at, expires_at, key_index, our_public_key,
        their_public_key, preimage_hash, swap_tree, lockup_address, timeout_block_height,
        invoice, expected_amount, onchain_amount, destination_address, lockup_tx_id,
        claim_tx_id, refunded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      swap.id,
      swap.direction,
      swap.asset,
      swap.status,
      swap.createdAt,
      swap.expiresAt,
      swap.keyIndex,
      swap.ourPublicKey,
      swap.theirPublicKey,
      swap.preimageHash,
      JSON.stringify(swap.swapTree),
      swap.lockupAddress,
      swap.timeoutBlockHeight,
      swap.invoice ?? null,
      swap.expectedAmount ?? null,
      swap.onchainAmount ?? null,
      swap.destinationAddress ?? null,
      swap.lockupTxId ?? null,
      swap.claimTxId ?? null,
      swap.refunded ? 1 : 0,
    ],
  );
}

export function getSwap(id: string): PersistedSwap | undefined {
  const r = conn().getFirstSync(`SELECT * FROM boltz_swaps WHERE id = ?`, [id]) as any | null;
  return r ? rowToSwap(r) : undefined;
}

export function listPendingSwaps(): PersistedSwap[] {
  return (
    conn().getAllSync(
      `SELECT * FROM boltz_swaps WHERE status NOT IN ('swap.expired', 'transaction.claimed', 'transaction.refunded') ORDER BY created_at DESC`,
    ) as any[]
  ).map(rowToSwap);
}

export function listSwaps(limit = 100): PersistedSwap[] {
  return (
    conn().getAllSync(`SELECT * FROM boltz_swaps ORDER BY created_at DESC LIMIT ?`, [limit]) as any[]
  ).map(rowToSwap);
}

export function updateSwapStatus(id: string, status: BoltzStatus): void {
  conn().runSync(`UPDATE boltz_swaps SET status = ? WHERE id = ?`, [status, id]);
}

export function updateSwapLockupTx(id: string, lockupTxId: string): void {
  conn().runSync(`UPDATE boltz_swaps SET lockup_tx_id = ? WHERE id = ?`, [lockupTxId, id]);
}

export function updateSwapClaimTx(id: string, claimTxId: string): void {
  conn().runSync(`UPDATE boltz_swaps SET claim_tx_id = ? WHERE id = ?`, [claimTxId, id]);
}

export function markSwapRefunded(id: string): void {
  conn().runSync(`UPDATE boltz_swaps SET refunded = 1, status = 'transaction.refunded' WHERE id = ?`, [id]);
}
