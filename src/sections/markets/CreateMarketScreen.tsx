// Permissionless market creation (Hunch core principle: anyone can pose any
// question). Builds the kind-30888 template, signs it with the MASTER identity
// via the scoped Core Signer capability, and publishes to the relays. The oracle
// pubkey is the market's trust anchor — remembered per section for reuse.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import { buildMarketTemplate } from './lib/build';
import { publishToRelays, queryRelays } from './lib/relay';
import { verifyEvent } from './lib/verify';
import { KIND_ORACLE_ANNOUNCE, marketId, aggregateReputation } from './lib/hunch';
import { fetchReputation } from './lib/oracle';
import { HUNCH_RELAYS, HUNCH_MINT_URL } from './marketsConfig';

interface OracleSuggestion {
  pubkey: string;
  announces: number;
  rep: string | null;
}

const DURATIONS = [
  { days: 1, key: 'd1' },
  { days: 7, key: 'd7' },
  { days: 30, key: 'd30' },
  { days: 90, key: 'd90' },
] as const;

const ORACLE_PREF_KEY = 'markets.lastOracle';

type AutoKind = 'manual' | 'price' | 'onchain' | 'weather' | 'http' | 'llm';
type Op = '>=' | '>' | '<=' | '<';

const AUTO_KINDS: { key: AutoKind; labelKey: string }[] = [
  { key: 'manual', labelKey: 'markets.create.auto.manual' },
  { key: 'price', labelKey: 'markets.create.auto.price' },
  { key: 'onchain', labelKey: 'markets.create.auto.onchain' },
  { key: 'weather', labelKey: 'markets.create.auto.weather' },
  { key: 'http', labelKey: 'markets.create.auto.http' },
  { key: 'llm', labelKey: 'markets.create.auto.llm' },
];
const OPS: Op[] = ['>=', '>', '<=', '<'];
const OC_METRICS = ['block_height', 'mempool_count', 'fee_fastest'];
const W_METRICS = ['precipitation_sum', 'temperature_2m_max', 'temperature_2m_min'];
const LLM_PROVIDERS = ['default', 'kimi', 'claude', 'consensus', 'failover'];

function slugify(question: string): string {
  const base = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'market'}-${Date.now().toString(36)}`;
}

export function CreateMarketScreen(): React.ReactElement {
  const caps = useSectionCapabilities();
  const [question, setQuestion] = useState('');
  const [resolution, setResolution] = useState('');
  const [oracle, setOracle] = useState(process.env.EXPO_PUBLIC_HUNCH_ORACLE ?? '');
  const [days, setDays] = useState(7);
  // Auto-resolution method ("oracle possibilities") — friendly presets that compile to
  // a connector resolution_spec, so a creator never writes raw JSON. 'manual' = no spec.
  const [autoKind, setAutoKind] = useState<AutoKind>('manual');
  const [op, setOp] = useState<Op>('>=');
  const [threshold, setThreshold] = useState('');
  const [asset, setAsset] = useState('BTC');
  const [quote, setQuote] = useState('USD');
  const [ocMetric, setOcMetric] = useState('block_height');
  const [wLat, setWLat] = useState('');
  const [wLon, setWLon] = useState('');
  const [wDate, setWDate] = useState('');
  const [wMetric, setWMetric] = useState('precipitation_sum');
  const [hUrl, setHUrl] = useState('');
  const [hPath, setHPath] = useState('');
  const [llmProvider, setLlmProvider] = useState('default');
  const [suggestions, setSuggestions] = useState<OracleSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Oracle discovery: ACTIVE announcers (kind 88) on the relays, decorated with
  // their aggregated reputation — pick instead of pasting a 64-hex key (UX).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const events = await queryRelays(HUNCH_RELAYS, { kinds: [KIND_ORACLE_ANNOUNCE], limit: 200 });
        const byOracle = new Map<string, number>();
        for (const ev of events) {
          if (!verifyEvent(ev)) continue;
          byOracle.set(ev.pubkey, (byOracle.get(ev.pubkey) ?? 0) + 1);
        }
        const top = [...byOracle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const out: OracleSuggestion[] = [];
        for (const [pubkey, announces] of top) {
          const sum = aggregateReputation(await fetchReputation(HUNCH_RELAYS, pubkey, 'oracle').catch(() => []));
          out.push({ pubkey, announces, rep: sum ? `${sum.avg}/100 (${sum.count})` : null });
        }
        if (!cancelled) setSuggestions(out);
      } catch {
        /* discovery is best-effort — manual entry stays */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Remember the last oracle used (per-section store) — the common case is one
  // trusted oracle reused across markets.
  useEffect(() => {
    caps.store
      .get(ORACLE_PREF_KEY)
      .then((v) => {
        if (v && !oracle) setOracle(v);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oracleValid = useMemo(() => /^[0-9a-f]{64}$/i.test(oracle.trim()), [oracle]);
  const canCreate = question.trim().length >= 8 && oracleValid && !busy;

  /** Compiles the chosen method into a connector resolution_spec, or undefined for manual.
   *  Throws on invalid input (caught in onCreate → friendly inline error). */
  const buildResolutionSpec = (): string | undefined => {
    if (autoKind === 'manual') return undefined;
    if (autoKind === 'llm') {
      const spec: Record<string, unknown> = { connector: 'llm', question: question.trim() };
      if (llmProvider !== 'default') spec.provider = llmProvider;
      return JSON.stringify(spec);
    }
    const th = Number(threshold);
    if (!threshold.trim() || !Number.isFinite(th)) throw new Error('threshold');
    switch (autoKind) {
      case 'price':
        return JSON.stringify({ connector: 'price', asset: asset.trim() || 'BTC', quote: quote.trim() || 'USD', op, threshold: th });
      case 'onchain':
        return JSON.stringify({ connector: 'onchain', metric: ocMetric, op, threshold: th });
      case 'weather': {
        const lat = Number(wLat);
        const lon = Number(wLon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('coords');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(wDate.trim())) throw new Error('date');
        return JSON.stringify({ connector: 'weather', lat, lon, date: wDate.trim(), metric: wMetric, op, threshold: th });
      }
      case 'http': {
        if (!hUrl.trim()) throw new Error('url');
        const path = hPath.split(/[.,]/).map((s) => s.trim()).filter(Boolean);
        if (path.length === 0) throw new Error('path');
        return JSON.stringify({ connector: 'http', url: hUrl.trim(), path, op, threshold: th });
      }
    }
    return undefined;
  };

  const onCreate = async () => {
    if (!canCreate) return;
    setErr(null);
    let resolutionSpec: string | undefined;
    try {
      resolutionSpec = buildResolutionSpec();
    } catch {
      setErr(t('markets.create.auto.invalid'));
      return;
    }
    setBusy(true);
    try {
      const expiry = Math.floor(Date.now() / 1000) + days * 24 * 3600;
      const slug = slugify(question);
      const template = buildMarketTemplate({
        slug,
        oracle: oracle.trim().toLowerCase(),
        expiry,
        mint: HUNCH_MINT_URL,
        dlcContract: 'hip-2',
        question: question.trim(),
        resolution: resolution.trim() || undefined,
        resolutionSpec,
      });
      const signed = await caps.signer.signHunchEvent(template);
      const ok = await publishToRelays(HUNCH_RELAYS, signed);
      if (!ok) {
        setErr(t('markets.createPublishErr'));
        return;
      }
      await caps.store.set(ORACLE_PREF_KEY, oracle.trim().toLowerCase()).catch(() => {});

      // If the creator is also the oracle, commit the nonce now so the market is
      // immediately bettable — otherwise a self-oracle market is a dead-end until the
      // creator manually announces from the detail page (the #1 "can't bet" trap).
      // Best-effort: a market with no announce is still valid; the oracle panel retries.
      if (oracle.trim().toLowerCase() === signed.pubkey.toLowerCase()) {
        setAnnouncing(true);
        try {
          const id = marketId(signed.pubkey, slug);
          const { nonce } = await caps.signer.oracleAnnounce(id);
          const ann = await caps.signer.signHunchEvent({
            kind: KIND_ORACLE_ANNOUNCE,
            tags: [['market', id], ['nonce', nonce]],
            content: 'committed via 21pay wallet',
          });
          await publishToRelays(HUNCH_RELAYS, ann);
          await caps.store.set('markets.myPubkey', signed.pubkey).catch(() => {});
        } catch {
          /* market stands; the oracle can still announce from the market page */
        } finally {
          setAnnouncing(false);
        }
      }
      router.replace({
        pathname: '/(sections)/markets/market',
        params: { creator: signed.pubkey, d: slug },
      });
    } catch {
      setErr(t('markets.createErr'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold title={t('markets.create.title')} scroll>
      <Text style={styles.lead}>{t('markets.create.lead')}</Text>

      <Text style={styles.eyebrow}>{t('markets.create.question')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={question}
        onChangeText={setQuestion}
        placeholder={t('markets.create.questionPh')}
        placeholderTextColor={theme.color.textMuted}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.eyebrow}>{t('markets.create.resolution')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={resolution}
        onChangeText={setResolution}
        placeholder={t('markets.create.resolutionPh')}
        placeholderTextColor={theme.color.textMuted}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.eyebrow}>{t('markets.create.expiry')}</Text>
      <View style={styles.chips}>
        {DURATIONS.map((d) => (
          <Pressable
            key={d.days}
            onPress={() => setDays(d.days)}
            accessibilityRole="button"
            style={[styles.chip, days === d.days && styles.chipOn]}
          >
            <Text style={[styles.chipText, days === d.days && styles.chipTextOn]}>
              {t(`markets.create.${d.key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Resolution method — the "oracle possibilities": manual, or an auto-resolution
          connector compiled into resolution_spec (mirrors hunch-web's create rubrique). */}
      <Text style={styles.eyebrow}>{t('markets.create.autoTitle')}</Text>
      <View style={styles.chips}>
        {AUTO_KINDS.map(({ key, labelKey }) => (
          <Pressable
            key={key}
            onPress={() => setAutoKind(key)}
            accessibilityRole="button"
            style={[styles.chip, autoKind === key && styles.chipOn]}
          >
            <Text style={[styles.chipText, autoKind === key && styles.chipTextOn]}>{t(labelKey)}</Text>
          </Pressable>
        ))}
      </View>

      {autoKind === 'price' ? (
        <View style={styles.paramRow}>
          <TextInput style={[styles.input, styles.flex1]} value={asset} onChangeText={setAsset} placeholder="asset (BTC)" placeholderTextColor={theme.color.textMuted} autoCapitalize="characters" autoCorrect={false} />
          <TextInput style={[styles.input, styles.flex1]} value={quote} onChangeText={setQuote} placeholder="quote (USD)" placeholderTextColor={theme.color.textMuted} autoCapitalize="characters" autoCorrect={false} />
        </View>
      ) : null}

      {autoKind === 'onchain' ? (
        <View style={styles.chips}>
          {OC_METRICS.map((m) => (
            <Pressable key={m} onPress={() => setOcMetric(m)} accessibilityRole="button" style={[styles.chip, ocMetric === m && styles.chipOn]}>
              <Text style={[styles.chipText, ocMetric === m && styles.chipTextOn]}>{m}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {autoKind === 'weather' ? (
        <>
          <View style={styles.paramRow}>
            <TextInput style={[styles.input, styles.flex1]} value={wLat} onChangeText={(v) => setWLat(v.replace(/[^0-9.\-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder="lat" placeholderTextColor={theme.color.textMuted} />
            <TextInput style={[styles.input, styles.flex1]} value={wLon} onChangeText={(v) => setWLon(v.replace(/[^0-9.\-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder="lon" placeholderTextColor={theme.color.textMuted} />
          </View>
          <TextInput style={styles.input} value={wDate} onChangeText={setWDate} placeholder="date (YYYY-MM-DD)" placeholderTextColor={theme.color.textMuted} autoCorrect={false} />
          <View style={styles.chips}>
            {W_METRICS.map((m) => (
              <Pressable key={m} onPress={() => setWMetric(m)} accessibilityRole="button" style={[styles.chip, wMetric === m && styles.chipOn]}>
                <Text style={[styles.chipText, wMetric === m && styles.chipTextOn]}>{m.replace('_2m', '').replace('_sum', '')}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {autoKind === 'http' ? (
        <>
          <TextInput style={styles.input} value={hUrl} onChangeText={setHUrl} placeholder="https://api.example.com/score" placeholderTextColor={theme.color.textMuted} autoCapitalize="none" autoCorrect={false} />
          <TextInput style={styles.input} value={hPath} onChangeText={setHPath} placeholder="path to number (data.0.score)" placeholderTextColor={theme.color.textMuted} autoCapitalize="none" autoCorrect={false} />
        </>
      ) : null}

      {autoKind === 'llm' ? (
        <View style={styles.chips}>
          {LLM_PROVIDERS.map((p) => (
            <Pressable key={p} onPress={() => setLlmProvider(p)} accessibilityRole="button" style={[styles.chip, llmProvider === p && styles.chipOn]}>
              <Text style={[styles.chipText, llmProvider === p && styles.chipTextOn]}>{p}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {autoKind !== 'manual' && autoKind !== 'llm' ? (
        <View style={styles.paramRow}>
          {OPS.map((o) => (
            <Pressable key={o} onPress={() => setOp(o)} accessibilityRole="button" style={[styles.opChip, op === o && styles.chipOn]}>
              <Text style={[styles.chipText, op === o && styles.chipTextOn]}>{o}</Text>
            </Pressable>
          ))}
          <TextInput
            style={[styles.input, styles.flex1]}
            value={threshold}
            onChangeText={(v) => setThreshold(v.replace(/[^0-9.\-]/g, ''))}
            keyboardType="numbers-and-punctuation"
            placeholder={t('markets.create.auto.threshold')}
            placeholderTextColor={theme.color.textMuted}
          />
        </View>
      ) : null}

      <Text style={styles.hint}>
        {autoKind === 'manual' ? t('markets.create.auto.manualNote') : t('markets.create.auto.autoNote')}
      </Text>

      <Text style={styles.eyebrow}>{t('markets.create.oracle')}</Text>
      <View style={styles.oracleList}>
        <Pressable
          onPress={async () => {
            try {
              const pk = await caps.signer.getNostrPubkey();
              setOracle(pk);
              // Prompt-free cache — unlocks the oracle panel on market pages.
              await caps.store.set('markets.myPubkey', pk).catch(() => {});
            } catch {
              setErr(t('markets.createErr'));
            }
          }}
          accessibilityRole="button"
          style={styles.oracleRow}
        >
          <Feather name="user" size={14} color={theme.color.accent} />
          <Text style={styles.oracleKey}>{t('markets.create.meAsOracle')}</Text>
          <Text style={styles.oracleMeta}>{t('markets.create.meAsOracleHint')}</Text>
        </Pressable>
      </View>
      {suggestions.length > 0 ? (
        <View style={styles.oracleList}>
          {suggestions.map((s) => (
            <Pressable
              key={s.pubkey}
              onPress={() => setOracle(s.pubkey)}
              accessibilityRole="button"
              style={[styles.oracleRow, oracle.trim().toLowerCase() === s.pubkey && styles.oracleRowOn]}
            >
              <Feather
                name="radio"
                size={14}
                color={oracle.trim().toLowerCase() === s.pubkey ? theme.color.accent : theme.color.textMuted}
              />
              <Text style={styles.oracleKey}>{s.pubkey.slice(0, 16)}…</Text>
              <Text style={styles.oracleMeta}>
                {t('markets.create.announces', { n: String(s.announces) })}
                {s.rep ? ` · ★ ${s.rep}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        style={styles.input}
        value={oracle}
        onChangeText={setOracle}
        placeholder={t('markets.create.oraclePh')}
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.oracleHintRow}>
        <Feather
          name={oracleValid ? 'check-circle' : 'info'}
          size={13}
          color={oracleValid ? theme.color.success : theme.color.textMuted}
        />
        <Text style={styles.hint}>{t('markets.create.oracleHint')}</Text>
      </View>

      <PrimaryButton
        label={announcing ? t('markets.create.announcing') : t('markets.create.cta')}
        onPress={onCreate}
        loading={busy}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Text style={styles.hint}>{t('markets.create.note')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 14, lineHeight: 20, color: theme.color.textMuted, marginBottom: theme.space.md },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.lg, marginBottom: theme.space.sm },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.body.fontFamily,
    fontSize: 14,
    color: theme.color.text,
  },
  multiline: { minHeight: 72 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  paramRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, marginTop: theme.space.sm },
  flex1: { flex: 1 },
  opChip: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.space.sm,
  },
  chipOn: { borderColor: theme.color.accent },
  chipText: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted },
  chipTextOn: { color: theme.color.accent },
  oracleList: { gap: theme.space.sm, marginBottom: theme.space.sm },
  oracleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  oracleRowOn: { borderColor: theme.color.accent },
  oracleKey: { fontFamily: theme.font.mono.fontFamily, fontSize: 12, color: theme.color.text },
  oracleMeta: { flex: 1, textAlign: 'right', fontFamily: theme.font.body.fontFamily, fontSize: 11, color: theme.color.textMuted },
  oracleHintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.sm, marginTop: theme.space.xs, marginBottom: theme.space.lg },
  hint: { flex: 1, fontFamily: theme.font.body.fontFamily, fontSize: 12, lineHeight: 17, color: theme.color.textMuted, marginTop: theme.space.sm },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.md, textAlign: 'center' },
});
