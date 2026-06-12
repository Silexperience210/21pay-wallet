// The ONLY surface a section may consume (CLAUDE.md constraint 5). Sections NEVER
// import walletProvider or core/keys — they receive this typed, scoped bundle from
// SectionHost. This is the WalletBackend of the sections layer: interface-only,
// no implementation, no concrete imports. Reused by Casino (Phase 5), Mineurs
// (Phase 6), and Markets (Phase 7).

/** A signed NIP-98 event — public by construction (mirrors core Nip98Event without
 *  importing it: this file must stay import-free). */
export interface SectionNip98Event {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface SectionCapabilities {
  wallet: {
    payInvoice(bolt11: string): Promise<{ preimage: string; feeSat: number }>;
    payLnAddress(addr: string, amountSat: number): Promise<{ preimage: string }>;
    createInvoice(amountSat: number, memo?: string): Promise<{ bolt11: string }>;
    /** Capability-gated: present only when the active backend can mint an on-chain
     *  address (used by Mineurs to land mining payouts in the in-app wallet, MINE-04). */
    getOnchainAddress?(): Promise<{ address: string }>;
  };
  signer: {
    signLnurlAuth(k1Hex: string, domain: string): Promise<{ sig: string; key: string }>;
    /** NIP-98 HTTP-auth signed with the master Nostr identity (unified identity —
     *  BitRent login, Phase 6). Only the SIGNED event crosses the seam. */
    signNip98(opts: { url: string; method: string; challenge: string }): Promise<SectionNip98Event>;
    /** The PUBLIC identity pubkey (hex) — needed to request auth challenges. */
    getNostrPubkey(): Promise<string>;
    /** Sign a Hunch protocol event with the master identity (MARKET-03). The host
     *  enforces a kind ALLOWLIST (markets/orders/disputes/reputation/oracle) —
     *  sections can never sign arbitrary kinds (no kind-0, no DMs — blast-radius). */
    signHunchEvent(template: { kind: number; tags: string[][]; content: string }): Promise<SectionNip98Event>;
    /** ORACLE MODE — commit (or reuse) the per-market nonce; returns the public R_x. */
    oracleAnnounce(marketId: string): Promise<{ nonce: string }>;
    /** ORACLE MODE — sign the outcome under the committed nonce. Refuses a second
     *  DIFFERENT outcome (equivocation = key leak); same outcome is idempotent. */
    oracleAttest(marketId: string, outcome: 'YES' | 'NO' | 'INVALID'): Promise<{ signature: string }>;
    /** ORACLE MODE — prompt-free state: has a nonce been committed / what was attested. */
    oracleState(marketId: string): Promise<{ announced: boolean; attested: string | null }>;
  };
  /** Small per-section persistence, host-namespaced. `set/get` = non-secret metadata
   *  (SQLite prefs); `setSecret/getSecret` = secret material (expo-secure-store) —
   *  e.g. per-position Cashu stake keys. Sections never touch core/state directly. */
  store: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    getSecret(key: string): Promise<string | null>;
    setSecret(key: string, value: string): Promise<void>;
    deleteSecret(key: string): Promise<void>;
  };
}
