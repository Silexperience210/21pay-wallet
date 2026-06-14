// Hunch wallet (deposit / balance / withdraw) on the operator's pre-audit mainnet mint,
// funded by the in-app wallet. Deposits are crash-safe — a paid-but-unminted deposit is
// recovered + credited on open (recoverPending), fixing "paid but not credited".
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, SecondaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import { balanceTotal, deposit, withdraw, recoverPending } from './cashuWallet';
import { HUNCH_MINT_URL, HUNCH_NETWORK, BET_MIN_SAT, BET_MAX_SAT } from './marketsConfig';

const clampAmount = (v: string) => v.replace(/[^0-9]/g, '');

export function HunchWalletScreen(): React.ReactElement {
  const caps = useSectionCapabilities();
  const mint = HUNCH_MINT_URL;
  const [balance, setBalance] = useState(0);
  const [depositAmount, setDepositAmount] = useState('1000');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      // Credit any paid-but-unminted deposit from a previous session, then read the balance.
      const recovered = await recoverPending(caps).catch(() => 0);
      if (recovered > 0) setNotice(t('markets.wallet.recovered', { sats: String(recovered) }));
      setBalance(await balanceTotal(caps, mint));
    } catch {
      setErr(t('markets.backendErr'));
    }
  }, [caps, mint]);

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

  const depSat = parseInt(depositAmount, 10) || 0;
  const wSat = parseInt(withdrawAmount, 10) || 0;
  const depValid = depSat >= BET_MIN_SAT && depSat <= BET_MAX_SAT;
  const wValid = wSat >= 1 && wSat <= balance;

  const onDeposit = async () => {
    if (!depValid || busy) return;
    setBusy('deposit');
    setErr(null);
    setNotice(null);
    try {
      const credited = await deposit(caps, mint, depSat);
      setNotice(t('markets.wallet.depositDone', { sats: String(credited) }));
      setBalance(await balanceTotal(caps, mint));
    } catch {
      setErr(t('markets.wallet.depositErr'));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const onWithdraw = async () => {
    if (!wValid || busy) return;
    setBusy('withdraw');
    setErr(null);
    setNotice(null);
    try {
      const paid = await withdraw(caps, mint, wSat);
      setNotice(t('markets.wallet.withdrawDone', { sats: String(paid) }));
      setWithdrawAmount('');
      setBalance(await balanceTotal(caps, mint));
    } catch {
      setErr(t('markets.wallet.withdrawErr'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenScaffold title={t('markets.wallet.title')} scroll>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.accent} />}
        contentContainerStyle={styles.list}
      >
        <View style={styles.balanceCard}>
          <View style={styles.netBadge}>
            <Feather name="zap" size={11} color={theme.color.accent} />
            <Text style={styles.netBadgeText}>{HUNCH_NETWORK} · cap {BET_MAX_SAT.toLocaleString('fr-FR')}</Text>
          </View>
          <Text style={styles.balanceLabel}>{t('markets.wallet.balance')}</Text>
          <Text style={styles.balanceValue}>
            {loading ? '…' : `${balance.toLocaleString('fr-FR')} sats`}
          </Text>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Text style={styles.eyebrow}>{t('markets.wallet.depositTitle')}</Text>
        <TextInput
          style={styles.input}
          value={depositAmount}
          onChangeText={(v) => setDepositAmount(clampAmount(v))}
          keyboardType="number-pad"
          placeholder={`${BET_MIN_SAT}–${BET_MAX_SAT}`}
          placeholderTextColor={theme.color.textMuted}
        />
        <PrimaryButton
          label={busy === 'deposit' ? t('markets.wallet.depositing') : t('markets.wallet.depositCta', { sats: String(depSat) })}
          onPress={onDeposit}
          loading={busy === 'deposit'}
        />

        <Text style={styles.eyebrow}>{t('markets.wallet.withdrawTitle')}</Text>
        <TextInput
          style={styles.input}
          value={withdrawAmount}
          onChangeText={(v) => setWithdrawAmount(clampAmount(v))}
          keyboardType="number-pad"
          placeholder={`1–${balance}`}
          placeholderTextColor={theme.color.textMuted}
        />
        <SecondaryButton
          label={busy === 'withdraw' ? t('markets.wallet.withdrawing') : t('markets.wallet.withdrawCta', { sats: String(wSat) })}
          onPress={onWithdraw}
        />

        <Text style={styles.note}>{t('markets.wallet.note')}</Text>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: theme.space.xl },
  balanceCard: {
    borderWidth: 1,
    borderColor: theme.color.accent,
    borderRadius: theme.radius.lg,
    padding: theme.space.xl,
    alignItems: 'center',
    gap: theme.space.xs,
    marginBottom: theme.space.lg,
  },
  netBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: theme.space.xs },
  netBadgeText: { fontFamily: theme.font.label.fontFamily, fontSize: 11, color: theme.color.accent },
  balanceLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.textMuted },
  balanceValue: { fontFamily: theme.font.mono.fontFamily, fontSize: 28, color: theme.color.text },
  notice: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.success, textAlign: 'center', marginBottom: theme.space.sm },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, textAlign: 'center', marginBottom: theme.space.sm },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.lg, marginBottom: theme.space.sm },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 15,
    color: theme.color.text,
    marginBottom: theme.space.sm,
  },
  note: { fontFamily: theme.font.body.fontFamily, fontSize: 12, lineHeight: 17, color: theme.color.textMuted, marginTop: theme.space.lg },
});
