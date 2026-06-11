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

// Flipped to true in 04-05 when the real Breez Spark backend replaces the stub
// (gated behind the 04-04 release-Hermes device checkpoint + the Breez API key).
// The connect UI keeps the rung visible but inactive until then (D-11 honesty).
export const SPARK_READY = false;

// Local Spark data directory. 04-05 wires the real expo-file-system documentDirectory.
export const SPARK_STORAGE_DIR = 'spark';

/** Assemble a SparkConfig from a stored seed + environment. */
export function buildSparkConfig(mnemonic: string, passphrase?: string): SparkConfig {
  return {
    mnemonic,
    passphrase: passphrase || undefined,
    storageDir: SPARK_STORAGE_DIR,
    apiKey: process.env.EXPO_PUBLIC_BREEZ_API_KEY ?? '',
    network: (process.env.EXPO_PUBLIC_BREEZ_NETWORK as 'mainnet' | 'signet') ?? 'signet',
  };
}
