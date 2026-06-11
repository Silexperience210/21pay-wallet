// The ONLY surface a section may consume (CLAUDE.md constraint 5). Sections NEVER
// import walletProvider or core/keys — they receive this typed, scoped bundle from
// SectionHost. This is the WalletBackend of the sections layer: interface-only,
// no implementation, no concrete imports. Reused by Casino (Phase 5), Mineurs
// (Phase 6), and Markets (Phase 7).

export interface SectionCapabilities {
  wallet: {
    payInvoice(bolt11: string): Promise<{ preimage: string; feeSat: number }>;
    payLnAddress(addr: string, amountSat: number): Promise<{ preimage: string }>;
    createInvoice(amountSat: number, memo?: string): Promise<{ bolt11: string }>;
  };
  signer: {
    signLnurlAuth(k1Hex: string, domain: string): Promise<{ sig: string; key: string }>;
  };
}
