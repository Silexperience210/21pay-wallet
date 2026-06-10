// Spark (self-hosted) backend config. The Breez Spark SDK unlocks with a BIP39 mnemonic
// + storageDir (D-12: a DEDICATED Spark seed, separate from the identity master seed —
// blast-radius separation, CLAUDE.md #2). The "unique password" (D-10) is an optional
// BIP39 passphrase on that seed. apiKey is the Breez API key (provisioned out-of-band).
export interface SparkConfig {
  mnemonic: string; // dedicated Spark seed (NOT the identity m/44'/1237' seed)
  passphrase?: string; // optional BIP39 passphrase = the user's "unique password" (D-10)
  storageDir: string; // local Spark data directory
  apiKey: string; // Breez API key (EXPO_PUBLIC_BREEZ_API_KEY)
  network: 'mainnet' | 'signet';
}
