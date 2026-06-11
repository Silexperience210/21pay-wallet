// Active-rentals dashboard (MINE-03): the user's rentals with remaining time, and
// live miner stats (hashrate/temp/shares) for the selected ACTIVE rental, polled
// every 10 s while this screen is mounted. A 502 (miner unreachable) renders a
// soft hint (D-07) — it never trips the section boundary.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import * as bitrentApi from './bitrentApi';
import type { BitrentRentalSummary, BitrentLiveStats } from './bitrentApi';

const LIVE_POLL_MS = 10_000;

function fmtRemaining(minutes: number): string {
  if (minutes <= 0) return t('miners.expired');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')}` : `${m} min`;
}

export function RentalsDashboardScreen(): React.ReactElement {
  const caps = useSectionCapabilities();
  const [rentals, setRentals] = useState<BitrentRentalSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<BitrentLiveStats | null>(null);
  const [liveUnreachable, setLiveUnreachable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      if (!bitrentApi.hasAuth()) {
        const ok = await bitrentApi.loginWithNostr(caps);
        if (!ok) {
          setErr(t('miners.authErr'));
          return;
        }
      }
      const list = await bitrentApi.listRentals();
      setRentals(list);
      // Default selection: the first active rental (live stats target).
      setSelected((cur) => cur ?? list.find((r) => r.status === 'active')?.id ?? null);
    } catch {
      setErr(t('miners.backendErr'));
    }
  }, [caps]);

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

  // Live stats poll for the selected ACTIVE rental (D-07).
  useEffect(() => {
    const target = rentals.find((r) => r.id === selected && r.status === 'active');
    if (!target) {
      setLive(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const stats = await bitrentApi.getLiveStats(target.id);
      if (cancelled) return;
      setLive(stats);
      setLiveUnreachable(stats == null);
    };
    tick();
    const interval = setInterval(tick, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected, rentals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const active = rentals.filter((r) => r.status === 'active' || r.status === 'pending');
  const past = rentals.filter((r) => r.status !== 'active' && r.status !== 'pending');

  const rentalRow = (r: BitrentRentalSummary) => (
    <Pressable
      key={r.id}
      onPress={() => setSelected(r.id)}
      accessibilityRole="button"
      style={[styles.row, selected === r.id && styles.rowOn]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{r.miner_name}</Text>
        <Text style={styles.rowSub}>
          {r.hashrate_ths} TH/s{r.pool_name ? ` · ${r.pool_name}` : ''} · {r.total_sats.toLocaleString('fr-FR')} sats
        </Text>
      </View>
      {r.status === 'active' ? (
        <Text style={styles.rowRemaining}>{fmtRemaining(r.remaining_minutes)}</Text>
      ) : (
        <Text style={styles.rowStatus}>{t(`miners.status.${r.status}` as const)}</Text>
      )}
    </Pressable>
  );

  return (
    <ScreenScaffold title={t('miners.dashboard.title')}>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.accent} />}
        contentContainerStyle={styles.list}
      >
        {loading ? (
          <Text style={styles.lead}>{t('miners.loading')}</Text>
        ) : rentals.length === 0 && !err ? (
          <Text style={styles.lead}>{t('miners.noRentals')}</Text>
        ) : (
          <>
            {active.length > 0 ? <Text style={styles.eyebrow}>{t('miners.activeRentals')}</Text> : null}
            {active.map(rentalRow)}

            {live || liveUnreachable ? (
              <View style={styles.liveCard}>
                <View style={styles.liveHead}>
                  <Feather name="activity" size={16} color={theme.color.accent} />
                  <Text style={styles.liveTitle}>{t('miners.live')}</Text>
                </View>
                {liveUnreachable ? (
                  <Text style={styles.lead}>{t('miners.liveUnreachable')}</Text>
                ) : live ? (
                  <View style={styles.liveGrid}>
                    <View style={styles.liveCell}>
                      <Text style={styles.liveValue}>{(live.hashrate ?? 0).toFixed(1)}</Text>
                      <Text style={styles.liveLabel}>GH/s</Text>
                    </View>
                    <View style={styles.liveCell}>
                      <Text style={styles.liveValue}>{(live.temp ?? 0).toFixed(0)}°</Text>
                      <Text style={styles.liveLabel}>{t('miners.temp')}</Text>
                    </View>
                    <View style={styles.liveCell}>
                      <Text style={styles.liveValue}>{live.sharesAccepted ?? 0}</Text>
                      <Text style={styles.liveLabel}>{t('miners.shares')}</Text>
                    </View>
                    <View style={styles.liveCell}>
                      <Text style={styles.liveValue}>{live.bestSessionDiff ?? 0}</Text>
                      <Text style={styles.liveLabel}>{t('miners.bestDiff')}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {past.length > 0 ? <Text style={styles.eyebrow}>{t('miners.pastRentals')}</Text> : null}
            {past.map(rentalRow)}
          </>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.space.sm, paddingBottom: theme.space.xl },
  eyebrow: {
    fontFamily: theme.font.label.fontFamily,
    fontSize: 13,
    color: theme.color.textMuted,
    marginTop: theme.space.md,
    marginBottom: theme.space.xs,
  },
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 14, color: theme.color.textMuted, textAlign: 'center', marginTop: theme.space.md },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginBottom: theme.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  rowOn: { borderColor: theme.color.accent },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.text },
  rowSub: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted },
  rowRemaining: { fontFamily: theme.font.mono.fontFamily, fontSize: 13, color: theme.color.accent },
  rowStatus: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.textMuted },
  liveCard: {
    borderWidth: 1,
    borderColor: theme.color.accent,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.md,
    marginVertical: theme.space.sm,
  },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  liveTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.text },
  liveGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  liveCell: { alignItems: 'center', gap: 2 },
  liveValue: { fontFamily: theme.font.mono.fontFamily, fontSize: 17, color: theme.color.text },
  liveLabel: { fontFamily: theme.font.body.fontFamily, fontSize: 11, color: theme.color.textMuted },
});
