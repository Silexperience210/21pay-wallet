// Wiring audit: every t('key') used in code must exist in BOTH i18n dicts; every
// router.push/replace pathname must match a file in app/. Exits 1 on any gap.
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x)) && !e.name.includes('.test.')) out.push(p);
  }
  return out;
}

const files = [...walk(path.join(ROOT, 'src'), ['.ts', '.tsx']), ...walk(path.join(ROOT, 'app'), ['.ts', '.tsx'])];

// ── i18n keys ──
const i18nSrc = fs.readFileSync(path.join(ROOT, 'src/i18n/index.ts'), 'utf8');
const enBlock = i18nSrc.slice(i18nSrc.indexOf('const en: Dict'), i18nSrc.indexOf('const fr: Dict'));
const frBlock = i18nSrc.slice(i18nSrc.indexOf('const fr: Dict'), i18nSrc.indexOf('const DICTS'));
const dictKeys = (block) => new Set([...block.matchAll(/'([^']+)':\s/g)].map((m) => m[1]));
const en = dictKeys(enBlock);
const fr = dictKeys(frBlock);

const usedKeys = new Set();
const dynamicPrefixes = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) usedKeys.add(m[1]);
  // template-literal keys: t(`onboarding.${rung}.title`) → record prefix/suffix
  for (const m of src.matchAll(/\bt\(\s*`([^`]+)`/g)) dynamicPrefixes.add(m[1]);
}

let fail = 0;
for (const k of [...usedKeys].sort()) {
  if (!en.has(k)) { console.log(`MISSING en: ${k}`); fail++; }
  if (!fr.has(k)) { console.log(`MISSING fr: ${k}`); fail++; }
}
for (const k of en) if (!fr.has(k)) { console.log(`fr lacks: ${k}`); fail++; }
for (const k of fr) if (!en.has(k)) { console.log(`en lacks: ${k}`); fail++; }
console.log(`dynamic key patterns (verify by eye): ${[...dynamicPrefixes].join(' | ')}`);

// ── routes ──
const routeTargets = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/router\.(?:push|replace)\(\s*(?:\{\s*pathname:\s*)?'([^']+)'/g)) {
    routeTargets.add(m[1]);
  }
}
const appFiles = walk(path.join(ROOT, 'app'), ['.tsx']).map((f) =>
  f.replace(path.join(ROOT, 'app'), '').replace(/\\/g, '/').replace(/\.tsx$/, ''),
);
function routeExists(target) {
  if (target === '/(tabs)') return appFiles.some((f) => f.startsWith('/(tabs)/'));
  const clean = target.replace(/\(([^)]+)\)\//g, '($1)/');
  return appFiles.some(
    (f) => f === clean || f === `${clean}/index` || f.replace(/\/index$/, '') === clean,
  );
}
for (const r of [...routeTargets].sort()) {
  if (!routeExists(r)) { console.log(`ROUTE MISSING: ${r}`); fail++; }
}
console.log(`checked: ${usedKeys.size} i18n keys, ${routeTargets.size} routes, ${files.length} files`);
process.exit(fail ? 1 : 0);
