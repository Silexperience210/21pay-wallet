// Mineurs marketplace (MINE-01): browse real miners + prices from BitRent, with
// the unified-identity login running in the background (D-02). All async work is
// try/caught so a backend outage degrades to an inline message — never an
// unhandled throw past the SectionErrorBoundary (MINE-05 layer 3).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, SecondaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import * as bitrentApi from './bitrentApi';
import type { BitrentMiner } from './bitrentApi';

function MinerCard({ miner, onRent }: { miner: BitrentMiner; onRent: () => void }): React.ReactElement {
  const rentedUntil =
    !miner.available && miner.rental_end_time
      ? new Date(miner.rental_end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : null;
  return (
    <Pressable
      onPress={miner.available ? onRent : undefined}
      disabled={!miner.available}
      accessibilityRole="button"
      style={[styles.card, !miner.available && styles.cardUnavailable]}
    >
      <View style={styles.cardHead}>
        <Feather name="cpu" size={18} color={miner.available ? theme.color.accent : theme.color.textMuted} />
        <Text style={styles.cardName}>{miner.name}</Text>
        <Text style={styles.cardModel}>{miner.model}</Text>
      </View>
      <View style={styles.cardStats}>
        <Text style={styles.cardStat}>{miner.hashrate_ths} TH/s</Text>
        <Text style={styles.cardStat}>{t('miners.uptime', { pct: miner.uptime_percentage })}</Text>
        <Text style={styles.cardPrice}>{t('miners.pricePerHour', { sats: String(miner.sats_per_hour) })}</Text>
      </View>
      {miner.available ? (
        <Text style={styles.cardCta}>{t('miners.rentCta')}</Text>
      ) : (
        <Text style={styles.cardRented}>
          {rentedUntil ? t('miners.rentedUntil', { time: rentedUntil }) : t('miners.rented')}
        </Text>
      )}
    </Pressable>
  );
}

export function MinersBrowseScreen(): React.ReactElement {
  const caps = useSectionCapabilities(); // NEVER useWallet (constraint 5)
  const [miners, setMiners] = useState<BitrentMiner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setMiners(await bitrentApi.getMiners());
    } catch {
      setErr(t('miners.backendErr'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Login runs in the background (browse is public) so renting is instant later.
      bitrentApi.loginWithNostr(caps).catch(() => {});
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [caps, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <ScreenScaffold title={t('miners.title')}>
      <View style={styles.headerRow}>
        <SecondaryButton label={t('miners.myRentals')} onPress={() => router.push('/(sections)/miners/dashboard')} />
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.accent} />}
        contentContainerStyle={styles.list}
      >
        {loading ? (
          <Text style={styles.lead}>{t('miners.loading')}</Text>
        ) : miners.length === 0 && !err ? (
          <Text style={styles.lead}>{t('miners.empty')}</Text>
        ) : (
          miners.map((m) => (
            <MinerCard
              key={m.id}
              miner={m}
              onRent={() =>
                router.push({
                  pathname: '/(sections)/miners/rent',
                  params: { minerId: m.id, name: m.name, satsPerMinute: String(m.sats_per_minute) },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerRow: { marginBottom: theme.space.md },
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
  cardUnavailable: { opacity: 0.55 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  cardName: { flex: 1, fontFamily: theme.font.label.fontFamily, fontSize: 15, color: theme.color.text },
  cardModel: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted },
  cardStats: { flexDirection: 'row', gap: theme.space.lg },
  cardStat: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.textMuted },
  cardPrice: { flex: 1, textAlign: 'right', fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.accent },
  cardCta: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.accent },
  cardRented: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.textMuted },
});
