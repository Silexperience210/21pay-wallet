// Live E2E probe of the @21pay LN-address claim path against the real LNbits, mirroring
// the app's calls (createCustodialAccount → enableFreeExtensions → claimLnAddress →
// well-known resolution). Throwaway account; safe to run. Node 18+ (global fetch).
//
// Run: node scripts/probe-lnaddress.mjs
const BASE = process.env.EXPO_PUBLIC_LNBITS_URL ?? 'https://21pay.org';
const name = `probe${Math.floor(Math.random() * 1e6)}`;

const j = (r) => r.text().then((t) => { try { return JSON.parse(t); } catch { return t; } });
const show = (label, status, body) =>
  console.log(`\n${label} → HTTP ${status}\n${typeof body === 'string' ? body.slice(0, 400) : JSON.stringify(body, null, 2).slice(0, 900)}`);

const main = async () => {
  console.log(`BASE=${BASE}  name=${name}`);

  // 1. Create a throwaway custodial account (LNbits v1 core).
  let r = await fetch(`${BASE}/api/v1/account`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `probe-${Date.now()}` }),
  });
  const acct = await j(r);
  show('1. POST /api/v1/account', r.status, acct);
  if (!acct?.inkey) return console.log('\n✗ no inkey — abort');
  const { user, inkey, adminkey } = acct;

  // 2. Login by usr → Bearer token (to enable extensions).
  r = await fetch(`${BASE}/api/v1/auth/usr`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: user }),
  });
  const auth = await j(r);
  show('2. POST /api/v1/auth/usr', r.status, auth);
  const token = auth?.access_token;

  // 3. Enable the lnurlp extension for this user.
  if (token) {
    r = await fetch(`${BASE}/api/v1/extension/lnurlp/enable`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` },
    });
    show('3. PUT /api/v1/extension/lnurlp/enable', r.status, await j(r));
  } else {
    console.log('\n3. (skipped enable — no token)');
  }

  const body = JSON.stringify({ description: `${name}@${new URL(BASE).hostname}`, username: name, min: 1, max: 100_000_000, comment_chars: 0 });

  // 4a. App's CURRENT call — invoice key.
  r = await fetch(`${BASE}/lnurlp/api/v1/links`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': inkey }, body,
  });
  show('4a. POST /lnurlp/api/v1/links (INVOICE key)', r.status, await j(r));

  // 4b. Same body, ADMIN key.
  r = await fetch(`${BASE}/lnurlp/api/v1/links`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': adminkey }, body,
  });
  const link = await j(r);
  show('4b. POST /lnurlp/api/v1/links (ADMIN key)', r.status, link);

  // 5. Resolve the Lightning Address after the admin-key create.
  r = await fetch(`${BASE}/.well-known/lnurlp/${name}`);
  show(`5. GET /.well-known/lnurlp/${name}`, r.status, await j(r));

  console.log(`\nadminkey present: ${!!adminkey}`);
};

main().catch((e) => console.error('probe error:', e));
