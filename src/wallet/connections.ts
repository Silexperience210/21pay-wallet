// Named NWC connection registry (D-02 multiple named connections, D-04 revocation,
// D-05 persist-all / switch-active). The metadata/secret SPLIT is the core invariant:
// non-secret metadata (label, pubkey, relay, active flag) lives in SQLite; the
// per-connection secret/URI lives ONLY in the biometric Vault (CLAUDE.md anti-pattern 4).
import {
  upsertNwcConnectionRow,
  listNwcConnectionRows,
  deleteNwcConnectionRow,
  setActiveNwcConnectionRow,
  type NwcConnectionRow,
} from '../core/state/db';
import { storeNwcSecret, loadNwcSecret, deleteNwcSecret } from '../core/keys';
import type { NwcConnectionConfig } from './backends/nwcRemote';

export interface NwcConnectionMeta {
  id: string;
  name: string;
  walletPubkey: string;
  relayUrl: string;
  isActive: boolean;
}

function rowToMeta(r: NwcConnectionRow): NwcConnectionMeta {
  return {
    id: r.id,
    name: r.name,
    walletPubkey: r.wallet_pubkey,
    relayUrl: r.relay_url,
    isActive: r.is_active === 1,
  };
}

/** Add or update a named connection: metadata → SQLite, secret/URI → Vault (D-04).
 *  The secret is NEVER written to the row. */
export async function addConnection(
  meta: { id: string; name: string; walletPubkey: string; relayUrl: string },
  uri: string,
): Promise<void> {
  upsertNwcConnectionRow({
    id: meta.id,
    name: meta.name,
    wallet_pubkey: meta.walletPubkey,
    relay_url: meta.relayUrl,
  });
  await storeNwcSecret(meta.id, uri);
}

/** All configured connections — metadata only, no secret. */
export function listConnections(): NwcConnectionMeta[] {
  return listNwcConnectionRows().map(rowToMeta);
}

/** Compose a row + its vault secret into a full NwcConnectionConfig, or null if missing. */
export async function loadConnectionConfig(id: string): Promise<NwcConnectionConfig | null> {
  const row = listNwcConnectionRows().find((r) => r.id === id);
  if (!row) return null;
  const uri = await loadNwcSecret(id);
  if (!uri) return null;
  return { id: row.id, name: row.name, walletPubkey: row.wallet_pubkey, relayUrl: row.relay_url, uri };
}

/** The active connection's full config (D-02 one active), or null. */
export async function getActiveConnectionConfig(): Promise<NwcConnectionConfig | null> {
  const active = listNwcConnectionRows().find((r) => r.is_active === 1);
  return active ? loadConnectionConfig(active.id) : null;
}

/** Make `id` the single active connection (D-02); all other configs are preserved (D-05). */
export function setActiveConnection(id: string): void {
  setActiveNwcConnectionRow(id);
}

/** Revoke a connection: delete the metadata row AND its vault secret (D-04). */
export async function deleteConnection(id: string): Promise<void> {
  deleteNwcConnectionRow(id);
  await deleteNwcSecret(id);
}
