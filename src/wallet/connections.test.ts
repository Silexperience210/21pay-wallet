// Connections registry contract (D-02, D-04, D-05). The db + vault layers are mocked
// so this exercises the metadata/secret SPLIT and composition logic in isolation.
jest.mock('../core/keys', () => ({
  storeNwcSecret: jest.fn(async () => {}),
  loadNwcSecret: jest.fn(async () => null),
  deleteNwcSecret: jest.fn(async () => {}),
}));
jest.mock('../core/state/db', () => ({
  upsertNwcConnectionRow: jest.fn(),
  listNwcConnectionRows: jest.fn(() => []),
  deleteNwcConnectionRow: jest.fn(),
  setActiveNwcConnectionRow: jest.fn(),
}));

import * as keys from '../core/keys';
import * as db from '../core/state/db';
import {
  addConnection,
  listConnections,
  loadConnectionConfig,
  setActiveConnection,
  deleteConnection,
} from './connections';

const META = { id: 'c1', name: 'Alby', walletPubkey: 'a'.repeat(64), relayUrl: 'wss://r1' };
const URI = `nostr+walletconnect://${'a'.repeat(64)}?relay=wss://r1&secret=${'b'.repeat(64)}`;

beforeEach(() => jest.clearAllMocks());

describe('connections — named NWC registry (D-02, D-04, D-05)', () => {
  it('D-02: addConnection writes metadata to SQLite and the secret to the Vault; list returns all', async () => {
    await addConnection(META, URI);
    expect(db.upsertNwcConnectionRow).toHaveBeenCalledWith({
      id: 'c1',
      name: 'Alby',
      wallet_pubkey: META.walletPubkey,
      relay_url: 'wss://r1',
    });
    expect(keys.storeNwcSecret).toHaveBeenCalledWith('c1', URI);

    (db.listNwcConnectionRows as jest.Mock).mockReturnValue([
      { id: 'c1', name: 'Alby', wallet_pubkey: META.walletPubkey, relay_url: 'wss://r1', is_active: 1 },
      { id: 'c2', name: 'Umbrel', wallet_pubkey: 'b'.repeat(64), relay_url: 'wss://r2', is_active: 0 },
    ]);
    expect(listConnections().map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('D-02: exactly one connection is active at a time', () => {
    (db.listNwcConnectionRows as jest.Mock).mockReturnValue([
      { id: 'c1', name: 'Alby', wallet_pubkey: 'a'.repeat(64), relay_url: 'wss://r1', is_active: 1 },
      { id: 'c2', name: 'Umbrel', wallet_pubkey: 'b'.repeat(64), relay_url: 'wss://r2', is_active: 0 },
    ]);
    expect(listConnections().filter((c) => c.isActive)).toHaveLength(1);
    setActiveConnection('c2');
    expect(db.setActiveNwcConnectionRow).toHaveBeenCalledWith('c2');
  });

  it('D-05: switching the active backend preserves all other configs (no delete/upsert)', () => {
    setActiveConnection('c2');
    expect(db.deleteNwcConnectionRow).not.toHaveBeenCalled();
    expect(db.upsertNwcConnectionRow).not.toHaveBeenCalled();
    expect(keys.deleteNwcSecret).not.toHaveBeenCalled();
  });

  it('D-05: a non-active connection stays reachable by loading its config', async () => {
    (db.listNwcConnectionRows as jest.Mock).mockReturnValue([
      { id: 'c2', name: 'Umbrel', wallet_pubkey: 'b'.repeat(64), relay_url: 'wss://r2', is_active: 0 },
    ]);
    (keys.loadNwcSecret as jest.Mock).mockResolvedValue('nostr+walletconnect://c2uri');
    const cfg = await loadConnectionConfig('c2');
    expect(cfg).toEqual({
      id: 'c2',
      name: 'Umbrel',
      walletPubkey: 'b'.repeat(64),
      relayUrl: 'wss://r2',
      uri: 'nostr+walletconnect://c2uri',
    });
  });

  it('D-04: delete removes the metadata row AND revokes the vault secret', async () => {
    await deleteConnection('c1');
    expect(db.deleteNwcConnectionRow).toHaveBeenCalledWith('c1');
    expect(keys.deleteNwcSecret).toHaveBeenCalledWith('c1');
  });

  it('D-04: only non-secret metadata reaches SQLite; the secret/URI goes to the Vault', async () => {
    await addConnection(META, URI);
    const rowArg = (db.upsertNwcConnectionRow as jest.Mock).mock.calls[0][0];
    expect(rowArg).not.toHaveProperty('uri');
    expect(rowArg).not.toHaveProperty('secret');
    expect(keys.storeNwcSecret).toHaveBeenCalledWith('c1', URI);
  });
});
