// One-off: create a fresh custodial wallet on the LIVE 21pay LNbits instance.
// Mirrors src/wallet/backends/custodialProvision.ts (createCustodialAccount).
// Reads secrets from the ENVIRONMENT — never hard-code or commit keys.
//
// Usage (PowerShell):
//   $env:EXPO_PUBLIC_LNBITS_URL="https://lnbits.21pay.org"
//   $env:LNBITS_ADMIN_KEY="<your 21pay admin key>"
//   node scripts/provision-21pay.mjs
//
// Usage (bash):
//   EXPO_PUBLIC_LNBITS_URL=https://lnbits.21pay.org LNBITS_ADMIN_KEY=xxxx node scripts/provision-21pay.mjs

const base = process.env.EXPO_PUBLIC_LNBITS_URL;
const adminKey = process.env.LNBITS_ADMIN_KEY;

if (!base || !adminKey) {
  console.error('Set EXPO_PUBLIC_LNBITS_URL and LNBITS_ADMIN_KEY in your environment first.');
  process.exit(1);
}

const root = base.replace(/\/+$/, '');

const res = await fetch(`${root}/usermanager/api/v1/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Api-Key': adminKey },
  body: JSON.stringify({ user_name: `21pay-${Date.now()}`, wallet_name: '21pay' }),
});

if (!res.ok) {
  console.error(
    `LNbits responded ${res.status} ${res.statusText}. ` +
      'Confirm the UserManager extension is enabled and the admin key can create users/wallets. ' +
      '(If your instance uses a different endpoint, tell me the error and I will adjust createCustodialAccount.)',
  );
  process.exit(1);
}

const data = await res.json();
const w = data.wallets?.[0];
if (!w) {
  console.error('No wallet in the response. Shape:', JSON.stringify(data).slice(0, 200));
  process.exit(1);
}

console.log('✓ Fresh custodial wallet created on 21pay LNbits:');
console.log('  user id   :', data.id);
console.log('  wallet id :', w.id);
console.log('  adminkey  :', w.adminkey);
console.log('  inkey     :', w.inkey);

try {
  const bal = await fetch(`${root}/api/v1/wallet`, { headers: { 'X-Api-Key': w.inkey } });
  if (bal.ok) {
    const b = await bal.json();
    console.log('  balance   :', Math.floor((b.balance ?? 0) / 1000), 'sat');
  }
} catch {
  /* balance check is best-effort */
}

console.log('\nKeep these wallet keys safe (do NOT commit). This proves ONBD-01 end-to-end.');
