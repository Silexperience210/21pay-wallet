// Req SEC-01/02/03 (logic) — VALIDATION.md "vault" row. Native modules mocked.
import * as Keychain from 'react-native-keychain';
import * as SecureStore from 'expo-secure-store';
import { storeMnemonic, loadMnemonic, detectSecurityLevel } from './vault';
import { NIP06_VECTOR_1 } from './fixtures/nip06-vectors';

const M = NIP06_VECTOR_1.mnemonic;

beforeEach(() => {
  (Keychain as unknown as { __reset: () => void }).__reset();
  (SecureStore as unknown as { __reset: () => void }).__reset();
});

describe('vault (encrypt-then-store, biometric DEK, level probe)', () => {
  it('stores CIPHERTEXT in secure-store, never the plaintext mnemonic', async () => {
    await storeMnemonic(M);
    const stored = await SecureStore.getItemAsync('mnemonic.ciphertext');
    expect(stored).not.toBeNull();
    expect(stored).not.toBe(M);
  });

  it('writes the DEK to keychain (not secure-store)', async () => {
    await storeMnemonic(M);
    const dek = await Keychain.getGenericPassword({ service: 'org.pay21.wallet.dek' });
    expect(dek).not.toBe(false);
  });

  it('round-trips load back to the original mnemonic', async () => {
    await storeMnemonic(M);
    expect(await loadMnemonic()).toBe(M);
  });

  it('falls back without crashing when SECURE_HARDWARE is unavailable', async () => {
    (Keychain as unknown as { __setHardwareFailure: (b: boolean) => void }).__setHardwareFailure(true);
    await expect(storeMnemonic(M)).resolves.toBeDefined();
    expect(await loadMnemonic()).toBe(M); // DEK still stored via ANY-level fallback
  });

  it('surfaces the runtime security level honestly', async () => {
    (Keychain as unknown as { __setSecurityLevel: (l: string) => void }).__setSecurityLevel(
      'SECURE_SOFTWARE',
    );
    const status = await detectSecurityLevel();
    expect(status.securityLevel).toBe('SECURE_SOFTWARE');
    expect(status.biometryEnrolled).toBe(true);
  });
});
