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

// LNbits v1 account creation is anonymous — no admin key needed.
const base = process.env.EXPO_PUBLIC_LNBITS_URL || 'https://21pay.org';
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

// LNbits v1 core: POST /api/v1/account creates a fresh wallet+account and returns
// its own keys. No admin key required (the <1.0.0 UserManager extension is not used).
let res;
try {
  res = await request(
    'POST',
    '/api/v1/account',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ name: `21pay-${Date.now()}` }),
  );
} catch (e) {
  console.error(`Connection failed: ${e.message}`);
  process.exit(1);
}
if (res.status !== 200 && res.status !== 201) {
  console.error(`LNbits responded ${res.status}: ${res.body.slice(0, 200)}`);
  process.exit(1);
}
const a = JSON.parse(res.body);
if (!a.adminkey || !a.inkey) {
  console.error('No wallet keys in response:', res.body.slice(0, 300));
  process.exit(1);
}
console.log('\nFresh custodial wallet created on 21pay LNbits (ONBD-01):');
console.log('  wallet id :', a.id);
console.log('  user id   :', a.user);
console.log('  adminkey  :', a.adminkey);
console.log('  inkey     :', a.inkey);
console.log('  balance   :', Math.floor((a.balance_msat ?? 0) / 1000), 'sat');
console.log('\nKeep these wallet keys safe (do NOT commit). This is a working custodial wallet on 21pay.');
