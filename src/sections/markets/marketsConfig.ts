// Markets section config (MARKET-06 / D-05). SIGNET IS THE HARD DEFAULT — there is
// no mainnet code path in v1 at all: the Hunch audit gate forbids mainnet before an
// external audit, and a flag the client could flip would violate "server-gated,
// cannot be flipped client-side". What does not exist cannot be enabled.
export const HUNCH_NETWORK = 'signet' as const;

/** Relays carrying the Hunch markets/oracle. Multi-relay by design (Hunch CLAUDE.md). */
export const HUNCH_RELAYS: string[] = (
  process.env.EXPO_PUBLIC_HUNCH_RELAYS ?? 'wss://relay.21pay.org,wss://nos.lol,wss://relay.damus.io'
)
  .split(',')
  .map((s: string) => s.trim())
  .filter((s: string) => s.startsWith('ws'));

/** The signet Cashu mint backing v1 stakes. A market's own `mint` tag wins when it is
 *  an https URL (multi-mint by design); this is only the fallback/display default. */
export const HUNCH_MINT_URL: string =
  process.env.EXPO_PUBLIC_HUNCH_MINT ?? 'https://mint-signet.21pay.org';

/** Bet bounds (signet pre-audit guardrails — generous but finite). */
export const BET_MIN_SAT = 10;
export const BET_MAX_SAT = 100_000;

/** Resolve the mint URL for a market: its `mint` tag when it's a usable https URL,
 *  else the configured signet default. */
export function mintUrlForMarket(marketMintTag: string): string {
  return /^https:\/\//i.test(marketMintTag) ? marketMintTag : HUNCH_MINT_URL;
}
