// Jest manual mock for expo-sqlite (node env has no native SQLite).
// Minimal in-memory backing for the exact SQL src/core/state/db.ts issues.

type Row = Record<string, unknown>;
const COLS = [
  'id',
  'backend_kind',
  'payment_hash',
  'direction',
  'amount_sat',
  'fee_sat',
  'status',
  'created_at',
  'memo',
];

let tables: Record<string, Row[]> = {};
function ensure(name: string): Row[] {
  if (!tables[name]) tables[name] = [];
  return tables[name];
}

export function openDatabaseSync(_name: string) {
  return {
    execSync(sql: string): void {
      if (/CREATE TABLE.*wallet_tx/is.test(sql)) ensure('wallet_tx');
    },
    runSync(sql: string, params: unknown[] = []): { changes: number } {
      if (/INSERT.*wallet_tx/is.test(sql)) {
        const arr = ensure('wallet_tx');
        const row: Row = {};
        COLS.forEach((c, i) => (row[c] = params[i] ?? null));
        const idx = arr.findIndex((r) => r.id === row.id);
        if (idx >= 0) arr[idx] = row;
        else arr.push(row);
        return { changes: 1 };
      }
      if (/UPDATE.*wallet_tx.*status/is.test(sql)) {
        const [status, id] = params;
        const r = ensure('wallet_tx').find((x) => x.id === id);
        if (r) r.status = status;
        return { changes: r ? 1 : 0 };
      }
      return { changes: 0 };
    },
    getAllSync(sql: string, params: unknown[] = []): Row[] {
      let rows = [...ensure('wallet_tx')];
      if (/backend_kind\s*=\s*\?/i.test(sql)) rows = rows.filter((r) => r.backend_kind === params[0]);
      if (/status\s*=\s*\?/i.test(sql)) rows = rows.filter((r) => r.status === params[1]);
      if (/ORDER BY created_at DESC/i.test(sql)) {
        rows.sort((a, b) => (b.created_at as number) - (a.created_at as number));
      }
      return rows;
    },
    getFirstSync(sql: string, params: unknown[] = []): Row | null {
      return this.getAllSync(sql, params)[0] ?? null;
    },
  };
}

export function __reset(): void {
  tables = {};
}
