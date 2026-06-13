// provisionArk — mint (or reuse) the DEDICATED Ark seed and assemble its config.
// The Ark seed is separate from the identity master seed AND the Spark seed
// (blast-radius, CLAUDE.md #2) and lives in the biometric vault; the optional
// password is a BIP39 passphrase, re-derived at unlock time, never stored.
import { cryptoSelfTest, generateMnemonic, storeArkSeed, loadArkSeed } from '../core/keys';
import { buildArkConfig, type ArkConfig } from './arkConfig';

/** Idempotent: reuses an already-provisioned Ark seed; generates one (CSPRNG
 *  self-test gated, CLAUDE.md #4) only when the vault has none. */
export async function provisionArk(opts?: { password?: string }): Promise<ArkConfig> {
  let mnemonic = await loadArkSeed();
  if (!mnemonic) {
    const st = cryptoSelfTest();
    if (!st.ok) {
      throw new Error(`crypto self-test failed: ${st.details.join('; ')}`);
    }
    mnemonic = generateMnemonic(128);
    await storeArkSeed(mnemonic);
  }
  return buildArkConfig(mnemonic, opts?.password);
}
