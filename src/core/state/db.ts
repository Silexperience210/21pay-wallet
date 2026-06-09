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
  db.execSync('PRAGMA user_version = 2'); // migration ordering slot
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
