import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  ScreenScaffold,
  BalanceDisplay,
  FiatLine,
  TxList,
  PrimaryButton,
  SecondaryButton,
  BackupBanner,
  SectionCard,
  theme,
} from '@/ui';
import { useWallet, syncHistory } from '@/wallet';
import { fetchSatFiatRate } from '@/wallet/price';
import { useWalletStore } from '@/core/state';
import { isFeatureEnabled, fetchFeatureGate } from '@/core/featureGate';
import { t } from '@/i18n';

export default function Home(): React.ReactElement {
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const balances = useWalletStore((s) => s.balances);
  const txByBackend = useWalletStore((s) => s.txByBackend);
  const setBalance = useWalletStore((s) => s.setBalance);
  const hydrateHistory = useWalletStore((s) => s.hydrateHistory);
  const [rate, setRate] = useState(0);
  // Server feature gate (DIST-02): the Casino entry renders only when the validated
  // gate enables it — fail-closed before/without a successful fetch.
  const [casinoEnabled, setCasinoEnabled] = useState(isFeatureEnabled('casino'));
  const [minersEnabled, setMinersEnabled] = useState(isFeatureEnabled('mineurs'));
  const [marketsEnabled, setMarketsEnabled] = useState(isFeatureEnabled('markets'));

  const refresh = useCallback(async () => {
    if (!activeBackendKind) return;
    try {
      const b = await useWallet().getBalance();
      setBalance(activeBackendKind, {
        backendKind: activeBackendKind,
        lightningSat: b.lightningSat,
        onchainSat: b.onchainSat,
      });
      await syncHistory().catch(() => {});
      hydrateHistory(activeBackendKind);
    } catch {
      /* keep last known balance */
    }
  }, [activeBackendKind, setBalance, hydrateHistory]);

  // Refresh whenever the tab regains focus (e.g. returning from Receive after a payment).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    refresh();
    fetchSatFiatRate('EUR')
      .then((r) => setRate(r.ratePerSat))
      .catch(() => {});
    fetchFeatureGate()
      .then(() => {
        setCasinoEnabled(isFeatureEnabled('casino'));
        setMinersEnabled(isFeatureEnabled('mineurs'));
        setMarketsEnabled(isFeatureEnabled('markets'));
      })
      .catch(() => {}); // fail-closed: entries stay hidden
  }, [refresh]);

  // No wallet yet → the sovereignty ladder is the SINGLE onboarding path (D-08).
  // The one-tap custodial entry that used to live here moved into the ladder.
  useEffect(() => {
    if (!activeBackendKind) router.replace('/onboarding');
  }, [activeBackendKind]);

  if (!activeBackendKind) {
    return <ScreenScaffold title={t('home.title.onboard')}><View /></ScreenScaffold>;
  }

  const bal = balances[activeBackendKind];
  const sats = bal?.lightningSat ?? 0;
  const txs = txByBackend[activeBackendKind] ?? [];

  return (
    <ScreenScaffold title={t('home.title.wallet')} scroll>
      <BackupBanner />
      <BalanceDisplay lightningSat={sats} onchainSat={bal?.onchainSat} />
      <FiatLine sats={sats} ratePerSat={rate} />
      <PrimaryButton label={t('home.tapToPay')} onPress={() => router.push('/nfc')} />
      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <SecondaryButton label={t('home.receive')} onPress={() => router.push('/receive')} />
        </View>
        <View style={styles.actionItem}>
          <SecondaryButton label={t('home.send')} onPress={() => router.push('/send')} />
        </View>
        <View style={styles.actionItem}>
          <SecondaryButton label={t('home.scan')} onPress={() => router.push('/scan')} />
        </View>
      </View>
      <Text style={styles.eyebrow}>{t('home.recent')}</Text>
      <TxList txs={txs} compact />
      <View style={styles.spacer} />
      {/* Univers 21pay (UX-02) — rich section cards, server-gated per flag
          (DIST-02, fail-closed hidden). Tints mirror the 21pay web theme orbs. */}
      {casinoEnabled || minersEnabled || marketsEnabled ? (
        <Text style={styles.eyebrow}>{t('home.universe')}</Text>
      ) : null}
      <View style={styles.sections}>
        {casinoEnabled ? (
          <SectionCard
            index={0}
            icon="target"
            tint={theme.color.accent}
            title={t('home.card.casino.title')}
            subtitle={t('home.card.casino.sub')}
            tag="live"
            onPress={() => router.push('/(sections)/casino')}
          />
        ) : null}
        {minersEnabled ? (
          <SectionCard
            index={1}
            icon="cpu"
            tint="#3ECF8E"
            title={t('home.card.miners.title')}
            subtitle={t('home.card.miners.sub')}
            tag="live"
            onPress={() => router.push('/(sections)/miners')}
          />
        ) : null}
        {marketsEnabled ? (
          <SectionCard
            index={2}
            icon="trending-up"
            tint="#7850ff"
            title={t('home.card.markets.title')}
            subtitle={t('home.card.markets.sub')}
            tag="mainnet"
            onPress={() => router.push('/(sections)/markets')}
          />
        ) : null}
        <SectionCard
          index={3}
          icon="file-text"
          tint="#ff5e74"
          title={t('home.card.cw.title')}
          subtitle={t('home.card.cw.sub')}
          onPress={() => router.push('/contentwall')}
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: theme.space.md, marginTop: theme.space.lg },
  actionItem: { flex: 1 },
  eyebrow: {
    fontFamily: theme.font.label.fontFamily,
    fontSize: 13,
    color: theme.color.textMuted,
    marginTop: theme.space.xl,
    marginBottom: theme.space.sm,
  },
  spacer: { height: theme.space.lg },
  sections: { gap: theme.space.md },
});
