// Markets browse (MARKET-01): kind-30888 events from the Hunch relays, every event
// Schnorr-verified before display (relays untrusted). All async work degrades to an
// inline message — never an unhandled throw past the boundary (MARKET-07 layer 3).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, SecondaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { KIND_MARKET, parseMarketEvent, type Market } from './lib/hunch';
import { verifyEvent } from './lib/verify';
import { queryRelays } from './lib/relay';
import { HUNCH_RELAYS, HUNCH_NETWORK } from './marketsConfig';

function isOpen(m: Market): boolean {
  return m.expiry > Math.floor(Date.now() / 1000);
}

type StatusFilter = 'all' | 'open' | 'expired';

export function MarketsBrowseScreen(): React.ReactElement {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    try {
      setErr(null);
      const events = await queryRelays(HUNCH_RELAYS, { kinds: [KIND_MARKET], limit: 100 });
      // 30888 is replaceable: relays may hold different versions — keep the newest.
      const seen = new Map<string, { market: Market; at: number }>();
      for (const ev of events) {
        if (!verifyEvent(ev)) continue; // forged events dropped
        const m = parseMarketEvent(ev);
        if (!m) continue;
        const prev = seen.get(m.id);
        if (!prev || ev.created_at > prev.at) seen.set(m.id, { market: m, at: ev.created_at });
      }
      setMarkets(
        [...seen.values()].map((e) => e.market).sort((a, b) => b.expiry - a.expiry),
      );
    } catch {
      setErr(t('markets.backendErr'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Client-side search (question) + open/expired filter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return markets.filter((m) => {
      if (status === 'open' && !isOpen(m)) return false;
      if (status === 'expired' && isOpen(m)) return false;
      if (q && !m.content.question.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [markets, search, status]);

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('markets.filter.all') },
    { key: 'open', label: t('markets.filter.open') },
    { key: 'expired', label: t('markets.filter.expired') },
  ];

  return (
    <ScreenScaffold title={t('markets.title')}>
      <View style={styles.headerRow}>
        <View style={styles.netBadge}>
          <Feather name="alert-circle" size={12} color={theme.color.accent} />
          <Text style={styles.netBadgeText}>{HUNCH_NETWORK}</Text>
        </View>
        <View style={styles.headerBtn}>
          <SecondaryButton label={t('markets.walletEntry')} onPress={() => router.push('/(sections)/markets/wallet')} />
        </View>
        <View style={styles.headerBtn}>
          <SecondaryButton label={t('markets.positions')} onPress={() => router.push('/(sections)/markets/positions')} />
        </View>
      </View>
      <View style={styles.createRow}>
        <SecondaryButton label={t('markets.createEntry')} onPress={() => router.push('/(sections)/markets/create')} />
      </View>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder={t('markets.search')}
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setStatus(f.key)}
            accessibilityRole="button"
            style={[styles.filterChip, status === f.key && styles.filterChipOn]}
          >
            <Text style={[styles.filterChipText, status === f.key && styles.filterChipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.accent} />}
        contentContainerStyle={styles.list}
      >
        {loading ? (
          <Text style={styles.lead}>{t('markets.loading')}</Text>
        ) : filtered.length === 0 && !err ? (
          <Text style={styles.lead}>{t('markets.empty')}</Text>
        ) : (
          filtered.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/(sections)/markets/market', params: { creator: m.creator, d: m.d } })
              }
              style={styles.card}
            >
              <Text style={styles.cardQuestion}>{m.content.question}</Text>
              <View style={styles.cardMeta}>
                <Text style={[styles.cardBadge, isOpen(m) ? styles.badgeOpen : styles.badgeClosed]}>
                  {isOpen(m) ? t('markets.open') : t('markets.expired')}
                </Text>
                {m.category ? <Text style={styles.cardCat}>{m.category}</Text> : null}
                <Text style={styles.cardExpiry}>
                  {new Date(m.expiry * 1000).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md, marginBottom: theme.space.sm },
  createRow: { marginBottom: theme.space.md },
  headerBtn: { flex: 1 },
  search: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    fontFamily: theme.font.body.fontFamily,
    fontSize: 14,
    color: theme.color.text,
    marginBottom: theme.space.sm,
  },
  filterRow: { flexDirection: 'row', gap: theme.space.sm, marginBottom: theme.space.sm },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs,
  },
  filterChipOn: { borderColor: theme.color.accent },
  filterChipText: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.textMuted },
  filterChipTextOn: { color: theme.color.accent },
  netBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.color.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs,
  },
  netBadgeText: { fontFamily: theme.font.label.fontFamily, fontSize: 11, color: theme.color.accent },
  list: { gap: theme.space.md, paddingBottom: theme.space.xl },
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 15, color: theme.color.textMuted, textAlign: 'center', marginTop: theme.space.xl },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginBottom: theme.space.sm },
  card: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
  },
  cardQuestion: { fontFamily: theme.font.label.fontFamily, fontSize: 15, lineHeight: 20, color: theme.color.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
  cardBadge: { fontFamily: theme.font.label.fontFamily, fontSize: 11 },
  badgeOpen: { color: theme.color.success },
  badgeClosed: { color: theme.color.textMuted },
  cardCat: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted },
  cardExpiry: { flex: 1, textAlign: 'right', fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted },
});
