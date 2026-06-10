// Receive modal — WALLET-01 (Lightning invoice) + WALLET-05 (on-chain address).
// Lightning: optional amount/memo → createInvoice → QR + copy. On-chain tab is shown
// only when the active backend exposes the capability. Never renders keys.
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { TextInput } from 'react-native';
import {
  ScreenScaffold,
  PrimaryButton,
  SecondaryButton,
  AmountInput,
  InvoiceCard,
  OnchainAddressCard,
  PaymentStatusSheet,
  theme,
} from '@/ui';
import { useWallet } from '@/wallet';
import type { PaymentStatus } from '@/wallet';
import { t } from '@/i18n';

type Tab = 'ln' | 'onchain';

export default function ReceiveScreen(): React.ReactElement {
  const wallet = useWallet();
  const onchainCapable = wallet.capabilities.onchain && typeof wallet.getOnchainAddress === 'function';

  const [tab, setTab] = useState<Tab>('ln');
  const [amountSat, setAmountSat] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const createInvoice = async () => {
    // LNbits rejects zero-amount invoices (the origin even 520s) — validate first.
    if (!amountSat || amountSat < 1) {
      setErr(t('receive.amountRequired'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { bolt11, paymentHash: hash } = await wallet.createInvoice(amountSat, memo || undefined);
      setInvoice(bolt11);
      setPaymentHash(hash ?? null);
      setPaid(false);
    } catch {
      setErr(t('receive.backendErr'));
    } finally {
      setBusy(false);
    }
  };

  // Watch the displayed invoice for settlement (~10 min at a 3 s cadence) so the
  // success animation fires the moment the payment lands. Cancelled on unmount.
  useEffect(() => {
    if (!invoice || !paymentHash || !wallet.reconcile) return;
    let cancelled = false;
    let status: PaymentStatus = 'pending';
    (async () => {
      for (let i = 0; i < 200 && !cancelled; i++) {
        try {
          status = await wallet.reconcile!(paymentHash, status);
        } catch {
          /* transient backend hiccup — keep watching */
        }
        if (cancelled) return;
        if (status === 'settled') {
          setPaid(true);
          return;
        }
        if (status === 'failed' || status === 'expired') return;
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoice, paymentHash, wallet]);

  const showAddress = async () => {
    if (!wallet.getOnchainAddress) return;
    setBusy(true);
    setErr(null);
    try {
      const { address: addr } = await wallet.getOnchainAddress();
      setAddress(addr);
    } catch {
      setErr(t('receive.backendErr'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold title={t('receive.title')} scroll>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.close}
      >
        <Feather name="chevron-left" size={26} color={theme.color.text} />
      </Pressable>

      {onchainCapable ? (
        <View style={styles.tabs}>
          {(['ln', 'onchain'] as Tab[]).map((tb) => (
            <Pressable
              key={tb}
              onPress={() => setTab(tb)}
              style={[styles.tab, tab === tb && styles.tabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === tb }}
            >
              <Text style={[styles.tabLabel, tab === tb && styles.tabLabelActive]}>
                {tb === 'ln' ? t('receive.lightning') : t('receive.onchain')}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab === 'ln' ? (
        invoice ? (
          <InvoiceCard data={invoice} kind="bolt11" />
        ) : (
          <View style={styles.form}>
            <AmountInput valueSat={amountSat} onChange={setAmountSat} />
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder={t('receive.memoPlaceholder')}
              placeholderTextColor={theme.color.textMuted}
              style={styles.memo}
              accessibilityLabel="Invoice memo"
            />
            <PrimaryButton label={t('receive.createInvoice')} onPress={createInvoice} loading={busy} />
          </View>
        )
      ) : address ? (
        <OnchainAddressCard address={address} />
      ) : (
        <View style={styles.form}>
          <Text style={styles.lead}>{t('receive.onchainLead')}</Text>
          <SecondaryButton label={t('receive.showAddress')} onPress={showAddress} />
        </View>
      )}

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {paid ? (
        <PaymentStatusSheet
          status="settled"
          detail={amountSat ? `+${amountSat} sats` : undefined}
          onClose={() => router.back()}
        />
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  close: { marginBottom: theme.space.sm, alignSelf: 'flex-start' },
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
  form: { gap: theme.space.xl },
  memo: {
    fontFamily: theme.font.body.fontFamily,
    fontSize: 16,
    color: theme.color.text,
    backgroundColor: theme.color.cardFill,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 15, color: theme.color.textMuted },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.lg },
});
