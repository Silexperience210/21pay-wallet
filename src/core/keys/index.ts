// Public Core surface. Raw key material is never exported (SEC-04 / constraint 5).
// Signer / vault / selftest exports are appended by later plans.
export {
  generateMnemonic,
  isValidMnemonic,
  deriveNostrIdentity,
  deriveBitcoinSpendingKey,
  importNsec,
  importMnemonic,
} from './derivation';
export type { KeyIdentity, SecurityLevel, VaultStatus } from './types';
export { signEvent } from './signer';
export { cryptoSelfTest } from './selftest';
export { storeMnemonic, loadMnemonic, hasMnemonic, detectSecurityLevel } from './vault';
export {
  storeNwcSecret,
  loadNwcSecret,
  deleteNwcSecret,
  storeSparkSeed,
  loadSparkSeed,
  hasSparkSeed,
  deleteSparkSeed,
} from './vault';
export { guardSecretScreen, releaseSecretScreen, restore, buildQuiz, checkQuiz } from './backup';
// LNURL-auth (LUD-04/05) casino-login primitive — returns {sig, key} only, never raw key bytes.
export { signLnurlAuth, deriveLnurlAuthKey } from './lnurlAuth';
// NIP-98 HTTP-auth over the master identity — returns the SIGNED (public) event only.
export { signNip98Auth } from './nostrAuth';
export type { Nip98Event } from './nostrAuth';
