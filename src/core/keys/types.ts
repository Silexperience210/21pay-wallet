// Public Core key surface contract.
// Raw key material is NEVER part of the exported surface (CLAUDE.md constraint 5 / SEC-04).
// Wave-2+ implementations bind to these types.

export type SecurityLevel = 'SECURE_HARDWARE' | 'SECURE_SOFTWARE' | 'ANY';

// PUBLIC identity only — no private-key field, ever.
export interface KeyIdentity {
  npub: string;
  pubkeyHex: string;
}

// Canonical hardened derivation paths. Identity and spending are SEPARATE
// so a leaked identity key can never move on-chain funds (IDENT-01 / constraint 2).
export type NostrDerivationPath = "m/44'/1237'/0'/0/0";
export type BitcoinDerivationPath = "m/44'/0'/0'/0/0";

export interface VaultStatus {
  securityLevel: SecurityLevel;
  biometryEnrolled: boolean;
}

export type SignerCapability = 'signNostrEvent';
