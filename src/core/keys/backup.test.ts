// Req SEC-05 (+ SEC-06 FLAG_SECURE lifecycle) — VALIDATION.md "backup" row.
import { restore, buildQuiz, checkQuiz, guardSecretScreen, releaseSecretScreen } from './backup';
import * as ScreenCapture from 'expo-screen-capture';
import { NIP06_VECTOR_1 } from './fixtures/nip06-vectors';

const WORDS = NIP06_VECTOR_1.mnemonic.trim().split(/\s+/);

describe('backup (checksum-gated restore + verification quiz + FLAG_SECURE)', () => {
  it('restore rejects an invalid BIP39 checksum and accepts a valid mnemonic', () => {
    expect(() => restore('invalid invalid invalid invalid invalid invalid')).toThrow();
    expect(restore(NIP06_VECTOR_1.mnemonic)).toBe(NIP06_VECTOR_1.mnemonic);
  });

  it('buildQuiz returns n distinct in-range word challenges', () => {
    const q = buildQuiz(NIP06_VECTOR_1.mnemonic, 3);
    expect(q.length).toBe(3);
    const idxs = q.map((c) => c.index);
    expect(new Set(idxs).size).toBe(3);
    idxs.forEach((i) => {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(WORDS.length);
    });
  });

  it('checkQuiz is true only when every supplied word is correct', () => {
    const q = buildQuiz(NIP06_VECTOR_1.mnemonic, 3);
    const correct = q.map((c) => ({ index: c.index, word: WORDS[c.index] }));
    expect(checkQuiz(NIP06_VECTOR_1.mnemonic, correct)).toBe(true);
    const wrong = correct.map((a, i) => (i === 0 ? { ...a, word: 'wrong' } : a));
    expect(checkQuiz(NIP06_VECTOR_1.mnemonic, wrong)).toBe(false);
    expect(checkQuiz(NIP06_VECTOR_1.mnemonic, [])).toBe(false);
  });

  it('guard/release toggle FLAG_SECURE via expo-screen-capture', async () => {
    await guardSecretScreen();
    await releaseSecretScreen();
    expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalled();
    expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalled();
  });
});
