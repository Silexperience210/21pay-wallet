// RED stub — Wave-0 gap enumeration for the named-connection list (D-02 multiple
// named NWC connections, D-04 revocation, D-05 persist-all / switch-active).
// Metadata (label/relay/active flag) in SQLite prefs; the secret in the Vault
// (Pattern 3 storeSecret/loadSecret/deleteSecret). Filled in the connections plan.
//
// Run: `npx jest src/wallet/connections.test.ts`

describe('connections — named NWC connection registry (D-02, D-04, D-05) [RED stub]', () => {
  // D-02: multiple named connections, one active.
  it.todo('D-02: upsert adds/updates a named connection; list returns all configured connections');
  it.todo('D-02: exactly one connection is the active spending backend at a time');

  // D-05: persist all, switch which is active — nothing is forgotten.
  it.todo('D-05: switching the active backend preserves all other configured connection configs');
  it.todo('D-05: a non-active connection stays reachable by switching back to it');

  // D-04: revocation = delete the stored connection + its vault secret.
  it.todo('D-04: delete removes the connection metadata AND deleteNwcSecret revokes the vault secret');

  // secret hygiene: never in SQLite plaintext (CLAUDE.md anti-pattern 4).
  it.todo('D-04: only non-secret metadata (label, relay host, active flag) is stored in SQLite; the secret lives in the Vault');
});
