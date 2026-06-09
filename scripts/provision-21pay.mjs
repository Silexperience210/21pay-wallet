// One-off: create a fresh custodial wallet on the LIVE 21pay LNbits instance.
// Reads secrets from the ENVIRONMENT — never hard-code or commit keys.
//
// This Windows box's FAI resolver does not resolve 21pay.org, so we resolve the
// A record via 1.1.1.1 (c-ares) and force the TCP connect to that IP while keeping
// SNI/Host = 21pay.org (the documented --connect-to workaround, in code).
//
// Usage (PowerShell): set the two env vars on SEPARATE lines, then run:
//   $env:LNBITS_ADMIN_KEY="<your 21pay admin key>"
//   node scripts/provision-21pay.mjs
import https from 'node:https';
import dns from 'node:dns';

const base = process.env.EXPO_PUBLIC_LNBITS_URL || 'https://21pay.org';
const adminKey = process.env.LNBITS_ADMIN_KEY;
if (!adminKey) {
  console.error('Set LNBITS_ADMIN_KEY in your environment first.');
  process.exit(1);
}

const host = new URL(base).hostname;

// Resolve via 1.1.1.1, bypassing the flaky FAI resolver.
dns.setServers(['1.1.1.1', '1.0.0.1']);
let ip;
try {
  ip = (await dns.promises.resolve4(host))[0];
} catch (e) {
  console.error(`Could not resolve ${host} via 1.1.1.1: ${e.message}`);
  process.exit(1);
}
console.log(`resolved ${host} -> ${ip} (via 1.1.1.1)`);

const forcedLookup = (_h, opts, cb) =>
  opts && opts.all ? cb(null, [{ address: ip, family: 4 }]) : cb(null, ip, 4);

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(
      { host, servername: host, port: 443, method, path, headers, lookup: forcedLookup, timeout: 15000 },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      },
    );
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('timeout')));
    if (body) r.write(body);
    r.end();
  });
}

const H = { 'Content-Type': 'application/json', 'X-Api-Key': adminKey };

// Requires the LNbits UserManager extension enabled on 21pay (Umbrel-side).
// Without it this returns 404 — and LNbits-core POST /api/v1/wallet needs a user
// access token (401 with just a wallet key), so UserManager is the supported path.
let res;
try {
  res = await request(
    'POST',
    '/usermanager/api/v1/users',
    H,
    JSON.stringify({ user_name: `21pay-${Date.now()}`, wallet_name: '21pay' }),
  );
} catch (e) {
  console.error(`Connection failed: ${e.message}`);
  process.exit(1);
}

if (res.status !== 200 && res.status !== 201) {
  console.error(`LNbits responded ${res.status}: ${res.body.slice(0, 200)}`);
  if (res.status === 404) {
    console.error(
      'UserManager extension is not enabled on 21pay. Enable it (LNbits → Extensions → User Manager) ' +
        'so the admin key can create users+wallets — then re-run this.',
    );
  }
  process.exit(1);
}

const data = JSON.parse(res.body);
const w = data.wallets?.[0];
if (!w) {
  console.error('No wallet in response:', JSON.stringify(data).slice(0, 300));
  process.exit(1);
}
console.log('\nFresh custodial wallet created on 21pay LNbits:');
console.log('  user id   :', data.id);
console.log('  wallet id :', w.id);
console.log('  adminkey  :', w.adminkey);
console.log('  inkey     :', w.inkey);
try {
  const bal = await request('GET', '/api/v1/wallet', { 'X-Api-Key': w.inkey });
  if (bal.status === 200) console.log('  balance   :', Math.floor((JSON.parse(bal.body).balance ?? 0) / 1000), 'sat');
} catch {
  /* best effort */
}
console.log('\nKeep these wallet keys safe (do NOT commit). Proves ONBD-01 end-to-end.');
