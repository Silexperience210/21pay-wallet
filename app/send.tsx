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
import { validateOnchainAddress, loadBoltzConfig, parseBoltzError } from '@/wallet/boltz';

const FEE_RATES: FeeRate[] = [
  { label: 'Slow', satPerVb: 1 },
  { label: 'Medium', satPerVb: 5 },
  { label: 'Fast', satPerVb: 15 },
];

interface OnchainSendQuote {
  min: number;
  max: number;
  onchainAmount: number;
  feeSat: number;
  percentage: number;
  minerFees: number;
}

type SwapStep =
  | 'creating'
  | 'payingHold'
  | 'awaitingLockup'
  | 'claiming'
  | 'broadcasting'
  | 'done';

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
  const [quote, setQuote] = useState<OnchainSendQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapStep, setSwapStep] = useState<SwapStep | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  const parsed = parsePaymentInput(destination);
  const detected = parsed.kind;
  const isOnchain = detected === 'onchain' || detected === 'bip21';
  const isLnurlish = detected === 'lnaddr' || detected === 'lnurl';
  const needsAmount = isLnurlish || isOnchain;
  const invoiceAmount = detected === 'bolt11' ? decodeBolt11Amount(destination) : null;
  const onchainAddress = parsed.kind === 'bip21' ? parsed.address : destination;

  // Pre-fill amount from BIP21 URI if the user hasn't already typed one.
  useEffect(() => {
    if (parsed.kind === 'bip21' && parsed.amountSat != null && amountSat == null) {
      setAmountSat(parsed.amountSat);
    }
  }, [parsed, amountSat]);

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

  // Validate on-chain address and fetch quote when amount/destination change.
  useEffect(() => {
    setQuote(null);
    setAddressError(null);
    if (!isOnchain || !wallet.getOnchainSendQuote) return;

    const address = onchainAddress.trim();
    if (!address) return;

    let network: 'bitcoin' | 'regtest';
    try {
      network = loadBoltzConfig().network === 'regtest' ? 'regtest' : 'bitcoin';
    } catch {
      network = 'bitcoin';
    }
    if (!validateOnchainAddress(address, network)) {
      setAddressError(t('send.onchainErr.invalidAddress'));
      return;
    }

    if (!amountSat || amountSat < 1) return;
    let cancelled = false;
    setQuoteLoading(true);
    wallet
      .getOnchainSendQuote(amountSat)
      .then((q) => {
        if (!cancelled) setQuote(q as OnchainSendQuote);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          const { key, params } = parseBoltzError(e);
          setQuote(null);
          setAddressError(t(key, params));
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [destination, amountSat, isOnchain, wallet, onchainAddress]);

  const inRange =
    amountSat == null
      ? false
      : (bounds.min == null || amountSat >= bounds.min) && (bounds.max == null || amountSat <= bounds.max);

  const payable =
    detected === 'bolt11' ||
    (isLnurlish && amountSat != null && amountSat > 0 && inRange) ||
    (isOnchain && amountSat != null && amountSat > 0 && !!wallet.sendOnchain && !addressError && !!quote);

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
        const address = parsed.kind === 'bip21' ? parsed.address : destination;
        if (!wallet.sendOnchain) throw new Error('On-chain not supported by this wallet.');
        setSwapStep('creating');
        const { txid } = await wallet.sendOnchain(address, amountSat ?? 0, feeRate, (step) => {
          if (step !== 'done') setSwapStep(step);
        });
        setSwapStep('done');
        await refreshBalance();
        setStatus('settled');
        return;
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
      const { key } = parseBoltzError(e);
      if (key === 'send.onchainErr.expired') setStatus('expired');
      else setStatus('failed');
    } finally {
      setSwapStep(null);
    }
  };

  const statusTitle =
    isOnchain && swapStep != null
      ? swapStep === 'creating'
        ? t('send.onchainCreating')
        : swapStep === 'payingHold'
          ? t('send.onchainPayingHold')
          : swapStep === 'awaitingLockup'
            ? t('send.onchainAwaitingLockup')
            : swapStep === 'claiming'
              ? t('send.onchainClaiming')
              : swapStep === 'broadcasting'
                ? t('send.onchainBroadcast')
                : t('send.onchainDone')
      : undefined;

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
          title={statusTitle}
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

              {addressError ? (
                <Text style={styles.warn}>{addressError}</Text>
              ) : quote ? (
                <View style={styles.quoteBox}>
                  <Text style={styles.quoteLine}>{t('send.onchainLimits', { min: quote.min, max: quote.max })}</Text>
                  <Text style={styles.quoteLine}>
                    {t('send.onchainFee', { fee: quote.feeSat, pct: quote.percentage })}
                  </Text>
                  <Text style={styles.quoteLine}>
                    {t('send.onchainReceiveAmount', { amount: quote.onchainAmount })}
                  </Text>
                </View>
              ) : quoteLoading ? (
                <Text style={styles.note}>{t('send.resolving')}</Text>
              ) : amountSat && amountSat > 0 ? (
                <Text style={styles.note}>{t('send.onchainLimits', { min: '?', max: '?' })}</Text>
              ) : null}

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
            disabled={!payable}
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
  quoteBox: {
    backgroundColor: theme.color.cardFill,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
  },
  quoteLine: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.text },
});
