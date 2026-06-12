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
import { KIND_ORACLE_ANNOUNCE, aggregateReputation } from './lib/hunch';
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
  const [suggestions, setSuggestions] = useState<OracleSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
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

  const onCreate = async () => {
    if (!canCreate) return;
    setErr(null);
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
      });
      const signed = await caps.signer.signHunchEvent(template);
      const ok = await publishToRelays(HUNCH_RELAYS, signed);
      if (!ok) {
        setErr(t('markets.createPublishErr'));
        return;
      }
      await caps.store.set(ORACLE_PREF_KEY, oracle.trim().toLowerCase()).catch(() => {});
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

      <Text style={styles.eyebrow}>{t('markets.create.oracle')}</Text>
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

      <PrimaryButton label={t('markets.create.cta')} onPress={onCreate} loading={busy} />
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
  chips: { flexDirection: 'row', gap: theme.space.sm },
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
