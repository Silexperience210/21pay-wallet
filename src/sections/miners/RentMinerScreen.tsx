// Rent flow (MINE-02/04): duration + pool + payout address → quote → EXPLICIT
// pay CTA via caps.wallet (D-03, never auto-pay) → poll status (the server-side
// activation trigger) until active. Payout address prefills from the wallet's
// on-chain address when the active backend can mint one (MINE-04 / D-04);
// otherwise the user pastes one, validated with the server's exact rules.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import * as bitrentApi from './bitrentApi';
import { BITRENT_POOLS, isValidPayoutAddress, type BitrentPoolId } from './bitrentConfig';

const DURATIONS = [
  { minutes: 30, key: 'm30' },
  { minutes: 60, key: 'h1' },
  { minutes: 180, key: 'h3' },
  { minutes: 360, key: 'h6' },
  { minutes: 720, key: 'h12' },
  { minutes: 1440, key: 'h24' },
] as const;

type Step = 'form' | 'paying' | 'activating' | 'active' | 'failed';

export function RentMinerScreen(): React.ReactElement {
  const caps = useSectionCapabilities();
  const params = useLocalSearchParams<{ minerId: string; name: string; satsPerMinute: string }>();
  const satsPerMinute = Number(params.satsPerMinute ?? 0);

  const [minutes, setMinutes] = useState<number>(60);
  const [poolId, setPoolId] = useState<BitrentPoolId>('ocean');
  const [payout, setPayout] = useState('');
  const [payoutFromWallet, setPayoutFromWallet] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [err, setErr] = useState<string | null>(null);

  const totalSats = useMemo(() => satsPerMinute * minutes, [satsPerMinute, minutes]);

  // MINE-04: land payouts in the in-app wallet when the backend can mint an
  // on-chain address (capability-optional — feature-detected, never assumed).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await caps.wallet.getOnchainAddress?.();
        if (!cancelled && r?.address && isValidPayoutAddress(r.address)) {
          setPayout(r.address);
          setPayoutFromWallet(true);
        }
      } catch {
        /* manual entry remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caps]);

  const canRent = isValidPayoutAddress(payout.trim()) && totalSats > 0 && step === 'form';

  const onRent = async () => {
    if (!canRent) return;
    setErr(null);
    try {
      // Ensure the session exists (login may still be in flight from Browse).
      if (!bitrentApi.hasAuth()) {
        const ok = await bitrentApi.loginWithNostr(caps);
        if (!ok) {
          setErr(t('miners.authErr'));
          return;
        }
      }
      const quote = await bitrentApi.createRental({
        minerId: String(params.minerId),
        durationMinutes: minutes,
        poolId,
        payoutAddress: payout.trim(),
      });
      // EXPLICIT payment — this CTA is the confirm (D-03). Never auto-paid.
      setStep('paying');
      await caps.wallet.payInvoice(quote.invoice);
      // The status poll is what triggers server-side miner activation.
      setStep('activating');
      const status = await bitrentApi.pollRentalUntilActive(quote.rental_id);
      if (status === 'active') {
        setStep('active');
      } else {
        setStep('failed');
        setErr(t('miners.activationSlow'));
      }
    } catch {
      setStep('failed');
      setErr(t('miners.rentErr'));
    }
  };

  if (step === 'active') {
    return (
      <ScreenScaffold title={t('miners.rent.title', { name: String(params.name ?? '') })}>
        <View style={styles.center}>
          <Feather name="check-circle" size={42} color={theme.color.success} />
          <Text style={styles.doneTitle}>{t('miners.activeTitle')}</Text>
          <Text style={styles.lead}>{t('miners.activeBody')}</Text>
          <PrimaryButton
            label={t('miners.goDashboard')}
            onPress={() => router.replace('/(sections)/miners/dashboard')}
          />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title={t('miners.rent.title', { name: String(params.name ?? '') })} scroll>
      <Text style={styles.eyebrow}>{t('miners.duration')}</Text>
      <View style={styles.chips}>
        {DURATIONS.map((d) => (
          <Pressable
            key={d.minutes}
            onPress={() => setMinutes(d.minutes)}
            accessibilityRole="button"
            style={[styles.chip, minutes === d.minutes && styles.chipOn]}
          >
            <Text style={[styles.chipText, minutes === d.minutes && styles.chipTextOn]}>
              {t(`miners.dur.${d.key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.eyebrow}>{t('miners.pool')}</Text>
      <View style={styles.chips}>
        {BITRENT_POOLS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPoolId(p.id)}
            accessibilityRole="button"
            style={[styles.chip, poolId === p.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, poolId === p.id && styles.chipTextOn]}>{p.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.eyebrow}>{t('miners.payout')}</Text>
      <TextInput
        style={styles.input}
        value={payout}
        onChangeText={(v) => {
          setPayout(v);
          setPayoutFromWallet(false);
        }}
        placeholder="bc1q…"
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        {payoutFromWallet ? t('miners.payoutWallet') : t('miners.payoutHint')}
      </Text>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('miners.total')}</Text>
        <Text style={styles.totalValue}>{totalSats.toLocaleString('fr-FR')} sats</Text>
      </View>

      <PrimaryButton
        label={
          step === 'paying'
            ? t('miners.payingCta')
            : step === 'activating'
              ? t('miners.activatingCta')
              : t('miners.payCta', { sats: totalSats.toLocaleString('fr-FR') })
        }
        onPress={onRent}
        loading={step === 'paying' || step === 'activating'}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: theme.font.label.fontFamily,
    fontSize: 13,
    color: theme.color.textMuted,
    marginTop: theme.space.lg,
    marginBottom: theme.space.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  chip: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
  },
  chipOn: { borderColor: theme.color.accent },
  chipText: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted },
  chipTextOn: { color: theme.color.accent },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 13,
    color: theme.color.text,
  },
  hint: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, marginTop: theme.space.xs },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: theme.space.xl,
  },
  totalLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.textMuted },
  totalValue: { fontFamily: theme.font.label.fontFamily, fontSize: 18, color: theme.color.text },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.md, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.lg, paddingHorizontal: theme.space.xl },
  doneTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 18, color: theme.color.text },
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 14, lineHeight: 20, color: theme.color.textMuted, textAlign: 'center' },
});
