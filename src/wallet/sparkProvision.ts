// provisionSpark — mint (or reuse) the DEDICATED Spark seed and assemble its config
// (ONBD-03). The Spark seed is separate from the identity master seed (D-12,
// blast-radius CLAUDE.md #2) and lives in the biometric vault (D-10); the optional
// "unique password" is a BIP39 passphrase on that seed — never stored, re-derived
// from user entry only at unlock time by the backend.
import { cryptoSelfTest, generateMnemonic, storeSparkSeed, loadSparkSeed } from '../core/keys';
import { buildSparkConfig, type SparkConfig } from './sparkConfig';

/** Idempotent: reuses an already-provisioned Spark seed; generates one (CSPRNG
 *  self-test gated, CLAUDE.md #4) only when the vault has none. */
export async function provisionSpark(opts?: { password?: string }): Promise<SparkConfig> {
  let mnemonic = await loadSparkSeed();
  if (!mnemonic) {
    const st = cryptoSelfTest();
    if (!st.ok) {
      throw new Error(`crypto self-test failed: ${st.details.join('; ')}`);
    }
    mnemonic = generateMnemonic(128);
    await storeSparkSeed(mnemonic);
  }
  return buildSparkConfig(mnemonic, opts?.password);
}
