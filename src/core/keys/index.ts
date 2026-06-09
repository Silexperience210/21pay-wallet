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
export { storeMnemonic, loadMnemonic, detectSecurityLevel } from './vault';
export { guardSecretScreen, releaseSecretScreen, restore, buildQuiz, checkQuiz } from './backup';
