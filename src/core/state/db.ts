// SQLite persistence for wallet history. Secrets are NEVER stored here
// (CLAUDE.md anti-pattern 4) — history/cache only. Secrets live in the Vault.
import { openDatabaseSync } from 'expo-sqlite';
import type { BackendKind, PaymentStatus, WalletTx } from '../../wallet/types';

type DB = ReturnType<typeof openDatabaseSync>;
let db: DB | null = null;

export function openDb(): DB {
  if (!db) db = openDatabaseSync('21pay.db');
  db.execSync(
    `CREATE TABLE IF NOT EXISTS wallet_tx (
      id TEXT PRIMARY KEY,
      backend_kind TEXT NOT NULL,
      payment_hash TEXT,
      direction TEXT,
      amount_sat INTEGER,
      fee_sat INTEGER,
      status TEXT,
      created_at INTEGER,
      memo TEXT
    )`,
  );
  // Non-secret app prefs (claimed LN address, backup-confirmed flag, …). Public
  // data only — NEVER secrets (those live in the Vault, CLAUDE.md anti-pattern 4).
  db.execSync(
    `CREATE TABLE IF NOT EXISTS prefs (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
  );
  // Named NWC connections (D-02). NON-SECRET metadata ONLY — the per-connection
  // secret/URI lives in the Vault (CLAUDE.md anti-pattern 4), never in this table.
  db.execSync(
    `CREATE TABLE IF NOT EXISTS nwc_connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wallet_pubkey TEXT,
      relay_url TEXT,
      is_active INTEGER DEFAULT 0
    )`,
  );
  db.execSync('PRAGMA user_version = 3'); // migration ordering slot (3 = + nwc_connections)
  return db;
}

/** Read a non-secret pref, or null. */
export function getPref(key: string): string | null {
  const r = conn().getFirstSync(`SELECT value FROM prefs WHERE key = ?`, [key]) as
    | { value?: string }
    | null;
  return r?.value ?? null;
}

/** Write a non-secret pref. NEVER store secrets here. */
export function setPref(key: string, value: string): void {
  conn().runSync(`INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)`, [key, value]);
}

function conn(): DB {
  return db ?? openDb();
}

// All values are bound as parameters — never string-concatenated (SQL-injection guard T-02-08).
export function insertTx(backendKind: BackendKind, tx: WalletTx): void {
  conn().runSync(
    `INSERT OR REPLACE INTO wallet_tx
       (id, backend_kind, payment_hash, direction, amount_sat, fee_sat, status, created_at, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tx.id,
      backendKind,
      tx.paymentHash ?? null,
      tx.direction,
      tx.amountSat,
      tx.feeSat ?? null,
      tx.status,
      tx.createdAt,
      tx.memo ?? null,
    ],
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToTx(r: any): WalletTx {
  return {
    id: r.id,
    paymentHash: r.payment_hash ?? undefined,
    direction: r.direction,
    amountSat: r.amount_sat,
    feeSat: r.fee_sat ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    memo: r.memo ?? undefined,
  };
}

export function listTxByBackend(backendKind: BackendKind): WalletTx[] {
  return (
    conn().getAllSync(
      `SELECT * FROM wallet_tx WHERE backend_kind = ? ORDER BY created_at DESC`,
      [backendKind],
    ) as any[]
  ).map(rowToTx);
}

export function listPending(backendKind: BackendKind): WalletTx[] {
  return (
    conn().getAllSync(
      `SELECT * FROM wallet_tx WHERE backend_kind = ? AND status = ? ORDER BY created_at DESC`,
      [backendKind, 'pending'],
    ) as any[]
  ).map(rowToTx);
}

export function updateTxStatus(id: string, status: PaymentStatus): void {
  conn().runSync(`UPDATE wallet_tx SET status = ? WHERE id = ?`, [status, id]);
}

/** Drop all cached transactions for a backend kind. Used when the active wallet changes
 *  so a fresh/different wallet never inherits a previous wallet's history (which would
 *  show a balance/history mismatch — e.g. orphaned-wallet txs lingering after a re-create). */
export function clearTxByBackend(backendKind: BackendKind): void {
  conn().runSync(`DELETE FROM wallet_tx WHERE backend_kind = ?`, [backendKind]);
}

// --- nwc_connections (D-02/D-04/D-05): non-secret metadata only ---

export interface NwcConnectionRow {
  id: string;
  name: string;
  wallet_pubkey: string;
  relay_url: string;
  is_active: number;
}

/** Insert or update a connection's metadata. is_active is preserved across updates
 *  (only setActiveNwcConnectionRow changes it) — new rows default inactive. */
export function upsertNwcConnectionRow(row: {
  id: string;
  name: string;
  wallet_pubkey: string;
  relay_url: string;
}): void {
  conn().runSync(
    `INSERT INTO nwc_connections (id, name, wallet_pubkey, relay_url, is_active)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, wallet_pubkey = excluded.wallet_pubkey, relay_url = excluded.relay_url`,
    [row.id, row.name, row.wallet_pubkey, row.relay_url],
  );
}

export function listNwcConnectionRows(): NwcConnectionRow[] {
  return conn().getAllSync(`SELECT * FROM nwc_connections ORDER BY name`) as NwcConnectionRow[];
}

export function deleteNwcConnectionRow(id: string): void {
  conn().runSync(`DELETE FROM nwc_connections WHERE id = ?`, [id]);
}

/** D-02: exactly one active connection. Clears all flags, then sets the chosen one —
 *  never deletes any other config (D-05 persist-all). */
export function setActiveNwcConnectionRow(id: string): void {
  conn().runSync(`UPDATE nwc_connections SET is_active = 0`);
  conn().runSync(`UPDATE nwc_connections SET is_active = 1 WHERE id = ?`, [id]);
}
