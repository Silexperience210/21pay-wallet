// Markets section config (MARKET-06 / D-05). MAINNET (operator decision): the Hunch
// mint that backs stakes is the operator's own pre-audit mainnet mint, hard-CAPPED at
// 100k sat/op, so the in-app (mainnet) wallet can actually fund deposits — a signet mint
// could never be paid from a mainnet wallet, which is why deposits weren't crediting.
// Real sats, pre-audit: keep the cap, no public marketing. Override the mint via env.
export const HUNCH_NETWORK = 'mainnet' as const;

/** Relays carrying the Hunch markets/oracle. Multi-relay by design (Hunch CLAUDE.md). */
export const HUNCH_RELAYS: string[] = (
  process.env.EXPO_PUBLIC_HUNCH_RELAYS ?? 'wss://relay.21pay.org,wss://nos.lol,wss://relay.damus.io'
)
  .split(',')
  .map((s: string) => s.trim())
  .filter((s: string) => s.startsWith('ws'));

/** The Cashu mint backing stakes + the Hunch wallet. A market's own `mint` tag wins when
 *  it is an https URL (multi-mint by design); this is the fallback/display default. */
export const HUNCH_MINT_URL: string =
  process.env.EXPO_PUBLIC_HUNCH_MINT ?? 'https://mint-mainnet.21pay.org';

/** Bet/deposit bounds — the upper bound matches the mint's per-op cap (100k, pre-audit). */
export const BET_MIN_SAT = 10;
export const BET_MAX_SAT = 100_000;

/** Resolve the mint URL for a market: its `mint` tag when it's a usable https URL,
 *  else the configured signet default. */
export function mintUrlForMarket(marketMintTag: string): string {
  return /^https:\/\//i.test(marketMintTag) ? marketMintTag : HUNCH_MINT_URL;
}

/** The Hunch web frontend (multi-frontend by design) — used to build shareable market
 *  links. Anyone hosting their own frontend can override via env. */
export const HUNCH_WEB_URL: string = (
  process.env.EXPO_PUBLIC_HUNCH_WEB ?? 'https://silexperience210.github.io/hunch'
).replace(/\/+$/, '');

/** A shareable link to a market on the web frontend (mirrors hunch-web's /market?id=). */
export function shareUrlForMarket(marketIdValue: string): string {
  return `${HUNCH_WEB_URL}/market/?id=${encodeURIComponent(marketIdValue)}`;
}

/** Operator Lightning Address opt-in tips go to (mint liquidity / oracle / hosting).
 *  Overridable via env so any operator hosting their own stack can redirect support. */
export const HUNCH_TIP_ADDRESS: string = (process.env.EXPO_PUBLIC_HUNCH_TIP_ADDRESS ?? 'tips@21pay.org').trim();
