// Ark / Arkade backend config (4th custody mode — self-sovereign L2). Like Spark,
// it unlocks with a DEDICATED seed (NOT the identity master seed — blast-radius,
// CLAUDE.md #2) and talks to an Ark Service Provider (ASP). The "unique password"
// is an optional BIP39 passphrase on that seed.
//
// ARK_READY stays false until the real @arkade-os/sdk (pre-1.0, native binding) is
// wired AND proven on a release-Hermes device build — same discipline as Spark
// (SPARK_READY). Shipping the rung+screen now, gated, lets the ladder be complete
// without a pre-1.0 native module breaking the Gradle build (Breez lesson).
export interface ArkConfig {
  mnemonic: string; // dedicated Ark seed (NOT the identity m/44'/1237' seed)
  passphrase?: string; // optional BIP39 passphrase = the user's "unique password"
  storageDir: string; // local Ark data directory
  serverUrl: string; // the Ark Service Provider (ASP) endpoint
  network: 'mainnet' | 'signet' | 'mutinynet';
}

// Flip to true in the device-checkpoint plan that wires the real @arkade-os/sdk.
export const ARK_READY = false;

export const ARK_STORAGE_DIR = 'ark';

/** Assemble an ArkConfig from a stored seed + environment. */
export function buildArkConfig(mnemonic: string, passphrase?: string): ArkConfig {
  return {
    mnemonic,
    passphrase: passphrase || undefined,
    storageDir: ARK_STORAGE_DIR,
    // Default to a signet/mutinynet ASP pre-audit; overridable for self-hosting.
    serverUrl: process.env.EXPO_PUBLIC_ARK_SERVER ?? 'https://mutinynet.arkade.sh',
    network: (process.env.EXPO_PUBLIC_ARK_NETWORK as 'mainnet' | 'signet' | 'mutinynet') ?? 'mutinynet',
  };
}
