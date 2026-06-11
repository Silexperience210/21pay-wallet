// Live end-to-end probe of the BitRent Nostr login (NIP-98) with a THROWAWAY key —
// proves the deployed challenge/verify contract matches src/sections/miners/bitrentApi.
// Run: node scripts/probe-bitrent-auth.mjs
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';

const ORIGIN = process.env.EXPO_PUBLIC_BITRENT_ORIGIN ?? 'https://bitrent.vercel.app';

const sk = generateSecretKey();
const pubkey = getPublicKey(sk);

const ch = await (
  await fetch(`${ORIGIN}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey }),
  })
).json();
console.log('challenge:', ch.challenge?.slice(0, 16) + '…');

const event = finalizeEvent(
  {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', `${ORIGIN}/api/auth/verify`],
      ['method', 'POST'],
    ],
    content: ch.challenge,
  },
  sk,
);

const verify = await (
  await fetch(`${ORIGIN}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  })
).json();
console.log('verify: token present =', typeof verify.token === 'string' && verify.token.length > 0, '| user role =', verify.user?.role);

const miners = await (await fetch(`${ORIGIN}/api/miners`)).json();
console.log('miners:', (miners.miners ?? []).map((m) => `${m.name} ${m.hashrate_ths}TH/s ${m.sats_per_hour}sats/h ${m.available ? 'dispo' : 'loué'}`).join(' | ') || '(aucun en ligne)');

const rentals = await (
  await fetch(`${ORIGIN}/api/rentals/list`, { headers: { Authorization: `Bearer ${verify.token}` } })
).json();
console.log('rentals/list (Bearer):', Array.isArray(rentals.rentals) ? `OK (${rentals.rentals.length})` : JSON.stringify(rentals));
