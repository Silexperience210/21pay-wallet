// Live end-to-end probe of the satoshi-casino21 LNURL-auth flow (LUD-04) with a
// THROWAWAY key — proves the deployed /api/auth/status returns session_id in the
// JSON body (fix 7a06b30) using the exact signing path the app uses.
// Run: node scripts/probe-casino-auth.mjs
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bech32 } from '@scure/base';

const ORIGIN = 'https://satoshi-casino21.vercel.app';

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

const gen = await (await fetch(`${ORIGIN}/api/auth/generate`)).json();
const decoded = new TextDecoder().decode(
  bech32.decodeToBytes(gen.lnurl.toLowerCase()).bytes,
);
const url = new URL(decoded);
const k1 = url.searchParams.get('k1');
console.log('k1:', k1, '| callback host:', url.hostname);

// throwaway keypair + LUD-04 signature (same noble path as src/core/keys/lnurlAuth.ts)
const sk = secp256k1.utils.randomSecretKey();
const key = bytesToHex(secp256k1.getPublicKey(sk, true));
const compact = secp256k1.sign(hexToBytes(k1), sk, { prehash: false });
const sig = secp256k1.Signature.fromBytes(compact).toHex('der').toLowerCase();

const cb = await (
  await fetch(`${ORIGIN}/api/auth/callback?tag=login&k1=${k1}&sig=${sig}&key=${key}`)
).json();
console.log('callback:', JSON.stringify(cb));

const st = await (await fetch(`${ORIGIN}/api/auth/status?k1=${k1}`)).json();
console.log('status keys:', Object.keys(st).join(','));
console.log('status:', st.status, '| session_id present:', typeof st.session_id === 'string' && st.session_id.length > 0);

const st2 = await (await fetch(`${ORIGIN}/api/auth/status?k1=${k1}`)).json();
console.log('re-poll (challenge consumed):', st2.status);
