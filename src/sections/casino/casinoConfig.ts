// Casino section config: origin allowlist + the confirmed satoshi-casino21 deposit
// bounds. The origin check is FAIL-CLOSED (T-05-10): it drives the WebView
// originWhitelist and the navigation guard in the lobby — anything that isn't
// https on the exact casino host is rejected, and a parse failure is a rejection.
export const CASINO_ORIGIN = process.env.EXPO_PUBLIC_CASINO_ORIGIN ?? 'https://satoshi-casino21.vercel.app';

/** For react-native-webview's originWhitelist prop. */
export const CASINO_ORIGIN_PATTERN = `${CASINO_ORIGIN}*`;

// Confirmed casino API contract (RESEARCH O-2, source Silexemple/satoshi-casino21).
export const DEPOSIT_MIN_SAT = 1000;
export const DEPOSIT_MAX_SAT = 100_000;
export const BALANCE_CAP_SAT = 1_000_000;

/** true ONLY for https + the exact casino hostname. Fail-closed: any parse
 *  failure, other protocol, or other host → false. Never throws. */
export function isCasinoOrigin(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === new URL(CASINO_ORIGIN).hostname;
  } catch {
    return false;
  }
}
