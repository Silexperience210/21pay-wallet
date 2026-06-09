// Send modal (WALLET-02/03/05). Auto-detects the destination (typed or pre-filled
// from Scan), collects the amount per type, and pays via useWallet() ONLY on the
// explicit CTA press (the irreversibility gate — no auto-pay). Drives the WALLET-09
// status sheet pending → settled/failed/expired, reconciling against the backend when
// it supports it. Never logs keys/preimage.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  ScreenScaffold,
  PrimaryButton,
  AmountInput,
  DestinationField,
  FeeRateChips,
  PaymentStatusSheet,
  theme,
} from '@/ui';
import type { FeeRate } from '@/ui/FeeRateChips';
import { useWallet, pollUntilTerminal, resolveLnurlPay } from '@/wallet';
import type { PaymentStatus } from '@/wallet';
import { parsePaymentInput, decodeBolt11Amount } from '@/wallet/parse';
import { formatSats } from '@/wallet/format';
import { useWalletStore } from '@/core/state';
import { t } from '@/i18n';

const FEE_RATES: FeeRate[] = [
  { label: 'Slow', satPerVb: 1 },
  { label: 'Medium', satPerVb: 5 },
  { label: 'Fast', satPerVb: 15 },
];

export default function SendScreen(): React.ReactElement {
  const wallet = useWallet();
  const params = useLocalSearchParams<{ destination?: string; amountSat?: string }>();
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const setBalance = useWalletStore((s) => s.setBalance);

  const [destination, setDestination] = useState(params.destination ?? '');
  const [amountSat, setAmountSat] = useState<number | null>(
    params.amountSat ? Number(params.amountSat) : null,
  );
  const [feeRate, setFeeRate] = useState(FEE_RATES[1].satPerVb);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [bounds, setBounds] = useState<{ min?: number; max?: number }>({});
  const [resolving, setResolving] = useState(false);

  const detected = parsePaymentInput(destination).kind;
  const isOnchain = detected === 'onchain' || detected === 'bip21';
  const isLnurlish = detected === 'lnaddr' || detected === 'lnurl';
  const needsAmount = isLnurlish || isOnchain;
  const invoiceAmount = detected === 'bolt11' ? decodeBolt11Amount(destination) : null;

  // Resolve LNURL-pay bounds so AmountInput can enforce min/max BEFORE paying (WALLET-03).
  useEffect(() => {
    setBounds({});
    if (!isLnurlish) return;
    let cancelled = false;
    setResolving(true);
    resolveLnurlPay(destination)
      .then((p) => {
        if (!cancelled) setBounds({ min: p.minSat, max: p.maxSat || undefined });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [destination, isLnurlish]);

  const inRange =
    amountSat == null
      ? false
      : (bounds.min == null || amountSat >= bounds.min) && (bounds.max == null || amountSat <= bounds.max);

  const payable =
    detected === 'bolt11' ||
    (isLnurlish && amountSat != null && amountSat > 0 && inRange) ||
    (isOnchain && amountSat != null && amountSat > 0 && !!wallet.sendOnchain);

  const refreshBalance = async () => {
    if (!activeBackendKind) return;
    try {
      const b = await wallet.getBalance();
      setBalance(activeBackendKind, {
        backendKind: activeBackendKind,
        lightningSat: b.lightningSat,
        onchainSat: b.onchainSat,
      });
    } catch {
      /* keep last known balance */
    }
  };

  const pay = async () => {
    setStatus('pending');
    try {
      let paymentHash: string | undefined;
      if (detected === 'bolt11') {
        ({ paymentHash } = await wallet.payInvoice(destination.replace(/^lightning:/i, '')));
      } else if (isLnurlish) {
        ({ paymentHash } = await wallet.payLnAddress(destination, amountSat ?? 0));
      } else if (isOnchain) {
        const addr = parsePaymentInput(destination);
        const address = addr.kind === 'bip21' ? addr.address : destination;
        if (!wallet.sendOnchain) throw new Error('On-chain not supported by this wallet.');
        await wallet.sendOnchain(address, amountSat ?? 0, feeRate);
      } else {
        throw new Error('Unknown destination.');
      }
      // The pay call resolving means success; reconcile only to DOWNGRADE if the
      // backend later reports a failure/expiry. Default stays settled.
      let final: PaymentStatus = 'settled';
      if (wallet.reconcile && paymentHash) {
        const polled = await pollUntilTerminal(
          (h, from, exp) => wallet.reconcile!(h, from, exp),
          paymentHash,
        );
        if (polled === 'failed' || polled === 'expired') final = polled;
      }
      await refreshBalance();
      setStatus(final);
    } catch (e) {
      const msg = (e as Error)?.message?.toLowerCase() ?? '';
      setStatus(msg.includes('expired') ? 'expired' : 'failed');
    }
  };

  const cta =
    detected === 'bolt11'
      ? t('send.payInvoice')
      : detected === 'lnaddr'
        ? `${t('send.pay')} ${destination}`
        : detected === 'lnurl'
          ? t('send.payLnurl')
          : isOnchain
            ? t('send.sendOnchain')
            : t('send.pay');

  return (
    <ScreenScaffold title={t('send.title')} scroll>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('nfc.close')}
        style={styles.close}
      >
        <Feather name="chevron-left" size={26} color={theme.color.text} />
      </Pressable>

      {status ? (
        <PaymentStatusSheet
          status={status}
          onClose={() => {
            if (status === 'settled') router.back();
            else setStatus(null);
          }}
        />
      ) : (
        <View style={styles.form}>
          <DestinationField value={destination} onChange={setDestination} detected={detected} />

          {detected === 'bolt11' ? (
            <Text style={styles.note}>
              {invoiceAmount != null ? formatSats(invoiceAmount) : t('send.amountFromInvoice')}
            </Text>
          ) : needsAmount ? (
            <>
              <AmountInput valueSat={amountSat} onChange={setAmountSat} min={bounds.min} max={bounds.max} />
              {resolving ? <Text style={styles.note}>{t('send.resolving')}</Text> : null}
            </>
          ) : null}

          {isOnchain ? (
            <>
              <FeeRateChips value={feeRate} onChange={setFeeRate} rates={FEE_RATES} />
              <Text style={styles.warn}>{t('send.onchainWarn')}</Text>
            </>
          ) : null}

          {detected === 'unknown' && destination.length > 0 ? (
            <Text style={styles.warn}>{t('send.unknownDest')}</Text>
          ) : null}

          <PrimaryButton
            label={cta}
            onPress={() => {
              if (payable) pay();
            }}
            destructive={isOnchain}
          />
          {!payable ? <Text style={styles.disabledHint}>{t('send.disabledHint')}</Text> : null}
        </View>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  close: { marginBottom: theme.space.sm, alignSelf: 'flex-start' },
  form: { gap: theme.space.xl },
  note: { fontFamily: theme.font.mono.fontFamily, fontSize: 14, color: theme.color.textMuted, textAlign: 'center' },
  warn: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.destructive, textAlign: 'center' },
  disabledHint: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.textMuted, textAlign: 'center' },
});
