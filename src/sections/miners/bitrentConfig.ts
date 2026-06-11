// BitRent section config (D-06). Origin pinned via env (same discipline as the
// casino origin); pools and bounds mirror the server EXACTLY
// (api/rentals/create.js, confirmed from source 2026-06-11) so invalid input is
// rejected before any request.

export const BITRENT_ORIGIN: string =
  process.env.EXPO_PUBLIC_BITRENT_ORIGIN ?? 'https://bitrent.vercel.app';

/** Server contract: duration_minutes integer 1..1440. */
export const RENT_MIN_MINUTES = 1;
export const RENT_MAX_MINUTES = 1440;

/** The server's pool registry (ids must match POOLS keys in rentals/create). */
export const BITRENT_POOLS = [
  { id: 'ocean', name: 'OCEAN' },
  { id: 'foundry', name: 'Foundry USA' },
  { id: 'luxor', name: 'Luxor' },
  { id: 'public', name: 'Public Pool' },
  { id: 'chauffagistes', name: 'Chauffagistes' },
] as const;

export type BitrentPoolId = (typeof BITRENT_POOLS)[number]['id'];

/** EXACT server-side payout validation (isValidBitcoinAddress in rentals/create). */
export function isValidPayoutAddress(addr: string): boolean {
  return (
    /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr) || // P2PKH
    /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr) || // P2SH
    /^bc1[a-z0-9]{6,87}$/.test(addr) // Bech32
  );
}

export function isValidDuration(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= RENT_MIN_MINUTES && minutes <= RENT_MAX_MINUTES;
}
