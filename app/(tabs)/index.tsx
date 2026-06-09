import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  ScreenScaffold,
  BalanceDisplay,
  FiatLine,
  TxList,
  PrimaryButton,
  SecondaryButton,
  theme,
} from '@/ui';
import { useWallet, createAndActivateCustodial } from '@/wallet';
import { fetchSatFiatRate } from '@/wallet/price';
import { useWalletStore } from '@/core/state';

export default function Home(): React.ReactElement {
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const balances = useWalletStore((s) => s.balances);
  const txByBackend = useWalletStore((s) => s.txByBackend);
  const setBalance = useWalletStore((s) => s.setBalance);
  const hydrateHistory = useWalletStore((s) => s.hydrateHistory);
  const [rate, setRate] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!activeBackendKind) return;
    try {
      const b = await useWallet().getBalance();
      setBalance(activeBackendKind, {
        backendKind: activeBackendKind,
        lightningSat: b.lightningSat,
        onchainSat: b.onchainSat,
      });
      hydrateHistory(activeBackendKind);
    } catch {
      /* keep last known balance */
    }
  }, [activeBackendKind, setBalance, hydrateHistory]);

  useEffect(() => {
    refresh();
    fetchSatFiatRate('EUR')
      .then((r) => setRate(r.ratePerSat))
      .catch(() => {});
  }, [refresh]);

  const onboard = async () => {
    setBusy(true);
    setErr(null);
    try {
      await createAndActivateCustodial();
      await refresh();
    } catch {
      setErr('Could not create the wallet — check the 21pay connection.');
    } finally {
      setBusy(false);
    }
  };

  if (!activeBackendKind) {
    return (
      <ScreenScaffold title="21pay">
        <Text style={styles.lead}>
          Your sovereign Bitcoin wallet. Create a custodial 21pay wallet to get started.
        </Text>
        <PrimaryButton label="Create my 21pay wallet" onPress={onboard} loading={busy} />
        {err ? <Text style={styles.err}>{err}</Text> : null}
      </ScreenScaffold>
    );
  }

  const bal = balances[activeBackendKind];
  const sats = bal?.lightningSat ?? 0;
  const txs = txByBackend[activeBackendKind] ?? [];

  return (
    <ScreenScaffold title="Wallet" scroll>
      <BalanceDisplay lightningSat={sats} onchainSat={bal?.onchainSat} />
      <FiatLine sats={sats} ratePerSat={rate} />
      <PrimaryButton label="⚡  Tap to pay (NFC)" onPress={() => router.push('/nfc')} />
      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <SecondaryButton label="Receive — soon" onPress={() => {}} />
        </View>
        <View style={styles.actionItem}>
          <SecondaryButton label="Send — soon" onPress={() => {}} />
        </View>
      </View>
      <Text style={styles.eyebrow}>Recent</Text>
      <TxList txs={txs} compact />
      <View style={styles.spacer} />
      <SecondaryButton label="Casino · Mineurs · Markets — soon" onPress={() => {}} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: theme.font.body.fontFamily,
    fontSize: 16,
    lineHeight: 22,
    color: theme.color.textMuted,
    marginBottom: theme.space.xl,
  },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.md },
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
});
