// Backup / restore surface.
// SEC-05: restore is BIP39-checksum-gated; a verification quiz gates the "backed up"
//   state so the user proves they recorded the words.
// SEC-06: secret-bearing screens call guardSecretScreen() on mount (FLAG_SECURE via
//   expo-screen-capture) and releaseSecretScreen() on unmount — per-screen, not app-wide.
// The seed is never auto-copied to the clipboard and never logged (Pitfall 5).
import { preventScreenCaptureAsync, allowScreenCaptureAsync } from 'expo-screen-capture';
import { importMnemonic } from './derivation';

export interface QuizChallenge {
  index: number;
}

export interface QuizAnswer {
  index: number;
  word: string;
}

/** Block screenshots/recording while a secret (seed) is on screen. Call on mount. */
export async function guardSecretScreen(): Promise<void> {
  await preventScreenCaptureAsync();
}

/** Re-allow screen capture once the secret screen unmounts. */
export async function releaseSecretScreen(): Promise<void> {
  await allowScreenCaptureAsync();
}

/** Restore from a user-supplied seed phrase; throws on an invalid BIP39 checksum. */
export function restore(words: string): string {
  return importMnemonic(words); // checksum gate; never log `words`
}

function randomIndex(bound: number): number {
  const wc = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } })
    .crypto;
  if (!wc?.getRandomValues) throw new Error('backup: no CSPRNG for quiz selection');
  const r = new Uint32Array(1);
  wc.getRandomValues(r);
  return r[0] % bound;
}

/** Pick `n` distinct word positions to challenge the user on. */
export function buildQuiz(mnemonic: string, n = 3): QuizChallenge[] {
  const words = mnemonic.trim().split(/\s+/);
  const count = Math.min(n, words.length);
  const chosen = new Set<number>();
  while (chosen.size < count) {
    chosen.add(randomIndex(words.length));
  }
  return [...chosen].sort((a, b) => a - b).map((index) => ({ index }));
}

/** The gate that flips "backed up" true: every supplied word must match (case-insensitive). */
export function checkQuiz(mnemonic: string, answers: QuizAnswer[]): boolean {
  if (answers.length === 0) return false;
  const words = mnemonic.trim().split(/\s+/);
  return answers.every(
    (a) => words[a.index]?.toLowerCase().trim() === a.word.toLowerCase().trim(),
  );
}
