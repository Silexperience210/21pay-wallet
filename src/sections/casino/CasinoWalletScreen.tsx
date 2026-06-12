// Casino wallet — explicit Deposit/Withdraw between the 21pay wallet and the casino
// account (D-03), with the casino balance shown DISTINCT from the wallet balance
// (D-04 / ONBD-05 — never summed, never written to the wallet store).
//
// Deposit: casino mints a BOLT11 (POST /api/deposit) → the WALLET pays it via
// caps.wallet.payInvoice → poll /api/check-payment until credited.
// Withdraw: the WALLET creates the invoice via caps.wallet.createInvoice → the
// casino pays it (POST /api/withdraw, fee reserve max(1%,10) per the contract).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ScreenScaffold, AmountInput, PrimaryButton, PaymentStatusSheet, theme } from '@/ui';
import type { PaymentStatus } from '@/wallet';
import { t } from '@/i18n';
import { formatSats } from '@/wallet/format';
import { useSectionCapabilities } from '../SectionHost';
import { DEPOSIT_MIN_SAT, DEPOSIT_MAX_SAT } from './casinoConfig';
import * as casinoApi from './casinoApi';

type Tab = 'deposit' | 'withdraw';

export function CasinoWalletScreen(): React.ReactElement {
  const caps = useSectionCapabilities(); // NEVER useWallet (constraint 5)
  const params = useLocalSearchParams<{ amountSat?: string; tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'withdraw' ? 'withdraw' : 'deposit');
  const parsedParamSat = params.amountSat ? parseInt(params.amountSat, 10) : null;
  const [amountSat, setAmountSat] = useState<number | null>(
    parsedParamSat != null && Number.isFinite(parsedParamSat) ? parsedParamSat : null,
  );
  const [casinoBalance, setCasinoBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    try {
      const { balance } = await casinoApi.getBalance();
      setCasinoBalance(balance); // SECTION state only — never the wallet store (D-04)
    } catch {
      /* keep last known */
    }
  }, []);

  // Modest focus-scoped polling (RESEARCH O-4): refresh on focus + every 20s while focused.
  useFocusEffect(
    useCallback(() => {
      refreshBalance();
      const id = setInterval(refreshBalance, 20_000);
      return () => clearInterval(id);
    }, [refreshBalance]),
  );

  useEffect(() => {
    setAmountSat(null);
    setErr(null);
    setStatus(null);
    setBusy(false);
  }, [tab]);

  const depositValid =
    amountSat != null && Number.isInteger(amountSat) && amountSat >= DEPOSIT_MIN_SAT && amountSat <= DEPOSIT_MAX_SAT;

  /** Casino keeps a fee reserve of max(1%, 10 sats) on withdrawals. */
  const withdrawFeeReserve = useCallback((amount: number) => Math.max(Math.ceil(amount * 0.01), 10), []);
  const maxWithdrawSat = casinoBalance != null ? Math.max(0, casinoBalance - withdrawFeeReserve(casinoBalance)) : undefined;
  const withdrawValid =
    amountSat != null && amountSat > 0 && (maxWithdrawSat == null || amountSat <= maxWithdrawSat);

  // layer 3 (CASINO-04): every async money action is try/caught — a backend failure
  // surfaces as a status/error, never an unhandled rejection escaping the section.
  const doDeposit = async () => {
    if (!depositValid || amountSat == null) return;
    setBusy(true);
    setErr(null);
    setStatus('pending');
    try {
      const { payment_hash, payment_request } = await casinoApi.deposit(amountSat);
      await caps.wallet.payInvoice(payment_request); // the wallet pays — explicit CTA only
      // Poll until the casino credits the deposit (~2 min at 3 s).
      let paid = false;
      for (let i = 0; i < 40 && !paid; i++) {
        ({ paid } = await casinoApi.checkPayment(payment_hash));
        if (!paid) await new Promise((r) => setTimeout(r, 3000));
      }
      setStatus(paid ? 'settled' : 'expired');
      await refreshBalance();
    } catch (e) {
      setStatus('failed');
      setErr(e instanceof Error && e.message ? e.message : t('casino.depositErr'));
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    if (!withdrawValid || amountSat == null) return;
    setBusy(true);
    setErr(null);
    setStatus('pending');
    try {
      const { bolt11 } = await caps.wallet.createInvoice(amountSat, 'Casino withdraw');
      await casinoApi.withdraw(bolt11); // the casino pays our invoice
      setStatus('settled');
      await refreshBalance();
    } catch (e) {
      setStatus('failed');
      setErr(e instanceof Error && e.message ? e.message : t('casino.withdrawErr'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold title={t('casino.wallet.title')} scroll>
      {/* Casino balance — DISTINCT from the wallet balance, clearly labelled (D-04). */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('casino.balance')}</Text>
        <Text style={styles.balanceValue}>
          {casinoBalance != null ? formatSats(casinoBalance) : '—'}
        </Text>
      </View>

      <View style={styles.tabs}>
        {(['deposit', 'withdraw'] as Tab[]).map((tb) => (
          <Pressable
            key={tb}
            onPress={() => setTab(tb)}
            style={[styles.tab, tab === tb && styles.tabActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === tb }}
          >
            <Text style={[styles.tabLabel, tab === tb && styles.tabLabelActive]}>
              {tb === 'deposit' ? t('casino.deposit.title') : t('casino.withdraw.title')}
            </Text>
          </Pressable>
        ))}
      </View>

      {status ? (
        <PaymentStatusSheet
          status={status}
          detail={amountSat ? `${tab === 'deposit' ? '→' : '←'} ${formatSats(amountSat)}` : undefined}
          onClose={() => setStatus(null)}
        />
      ) : (
        <View style={styles.form}>
          {tab === 'deposit' ? (
            <>
              <AmountInput valueSat={amountSat} onChange={setAmountSat} min={DEPOSIT_MIN_SAT} max={DEPOSIT_MAX_SAT} />
              <Text style={styles.note}>{t('casino.deposit.min', { min: String(DEPOSIT_MIN_SAT) })}</Text>
              <PrimaryButton label={t('casino.deposit.cta')} onPress={doDeposit} loading={busy} />
              {!depositValid && amountSat != null ? (
                <Text style={styles.warn}>{t('casino.deposit.bounds')}</Text>
              ) : null}
            </>
          ) : (
            <>
              <AmountInput valueSat={amountSat} onChange={setAmountSat} max={maxWithdrawSat} />
              <Text style={styles.note}>{t('casino.withdraw.note')}</Text>
              {maxWithdrawSat != null && maxWithdrawSat > 0 && amountSat != null && amountSat > maxWithdrawSat ? (
                <Text style={styles.warn}>{t('casino.withdraw.overMax', { max: String(maxWithdrawSat) })}</Text>
              ) : null}
              <PrimaryButton label={t('casino.withdraw.cta')} onPress={doWithdraw} loading={busy} />
            </>
          )}
          {err ? <Text style={styles.warn}>{err}</Text> : null}
        </View>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    alignItems: 'center',
    backgroundColor: theme.color.cardFill,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingVertical: theme.space.lg,
    marginBottom: theme.space.xl,
    gap: theme.space.xs,
  },
  balanceLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted },
  balanceValue: { fontFamily: theme.font.mono.fontFamily, fontSize: 28, color: theme.color.text },
  tabs: {
    flexDirection: 'row',
    gap: theme.space.sm,
    backgroundColor: theme.color.cardFill,
    borderRadius: theme.radius.pill,
    padding: theme.space.xs,
    marginBottom: theme.space.xl,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: theme.space.sm, borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.color.surface },
  tabLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.textMuted },
  tabLabelActive: { color: theme.color.text },
  form: { gap: theme.space.lg },
  note: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.textMuted, textAlign: 'center' },
  warn: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.destructive, textAlign: 'center' },
});
