// Place-bet screen (MARKET-03): outcome + amount + order price → ONE explicit CTA
// that (1) pays the mint deposit invoice from the in-app wallet, (2) mints proofs
// P2PK-locked to L_X, (3) publishes the Core-signed kind-38888 order. Never
// auto-paid; every async failure renders inline (MARKET-07 layer 3).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import {
  KIND_MARKET,
  marketId,
  parseMarketEvent,
  type Market,
  type OracleAnnounce,
} from './lib/hunch';
import { verifyEvent } from './lib/verify';
import { queryRelays } from './lib/relay';
import { fetchAnnounce } from './lib/oracle';
import { placeBet } from './betFlow';
import { HUNCH_RELAYS, BET_MIN_SAT, BET_MAX_SAT } from './marketsConfig';

type Step = 'form' | 'staking' | 'done';

export function PlaceBetScreen(): React.ReactElement {
  const caps = useSectionCapabilities();
  const params = useLocalSearchParams<{ creator: string; d: string }>();
  const creator = String(params.creator ?? '');
  const d = String(params.d ?? '');
  const id = marketId(creator, d);

  const [market, setMarket] = useState<Market | null>(null);
  const [announce, setAnnounce] = useState<OracleAnnounce | null>(null);
  const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('1000');
  const [price, setPrice] = useState('50');
  const [step, setStep] = useState<Step>('form');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const evs = await queryRelays(HUNCH_RELAYS, { kinds: [KIND_MARKET], authors: [creator], '#d': [d], limit: 5 });
      for (const ev of evs) {
        if (!verifyEvent(ev)) continue;
        const m = parseMarketEvent(ev);
        if (m && m.id === id) {
          setMarket(m);
          setAnnounce(await fetchAnnounce(HUNCH_RELAYS, m.oracle, id));
          return;
        }
      }
      setErr(t('markets.notFound'));
    } catch {
      setErr(t('markets.backendErr'));
    }
  }, [creator, d, id]);

  useEffect(() => {
    load();
  }, [load]);

  const amountSat = parseInt(amount, 10) || 0;
  const priceNum = parseInt(price, 10) || 0;
  const valid =
    market != null &&
    announce != null &&
    amountSat >= BET_MIN_SAT &&
    amountSat <= BET_MAX_SAT &&
    priceNum >= 1 &&
    priceNum <= 99;

  const onBet = async () => {
    if (!valid || !market || !announce) return;
    setErr(null);
    setStep('staking');
    try {
      await placeBet(caps, market, announce, { outcome, amountSat, price: priceNum });
      setStep('done');
    } catch (e) {
      setStep('form');
      setErr(e instanceof Error && /bounds|price/.test(e.message) ? e.message : t('markets.betErr'));
    }
  };

  if (step === 'done') {
    return (
      <ScreenScaffold title={t('markets.bet.title')}>
        <View style={styles.center}>
          <Feather name="check-circle" size={42} color={theme.color.success} />
          <Text style={styles.doneTitle}>{t('markets.betDone')}</Text>
          <Text style={styles.lead}>{t('markets.betDoneBody', { outcome, sats: String(amountSat) })}</Text>
          <PrimaryButton
            label={t('markets.positions')}
            onPress={() => router.replace('/(sections)/markets/positions')}
          />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title={t('markets.bet.title')} scroll>
      {market ? <Text style={styles.question}>{market.content.question}</Text> : null}

      <Text style={styles.eyebrow}>{t('markets.outcome')}</Text>
      <View style={styles.chips}>
        {(['YES', 'NO'] as const).map((o) => (
          <Pressable
            key={o}
            onPress={() => setOutcome(o)}
            accessibilityRole="button"
            style={[styles.chip, outcome === o && styles.chipOn]}
          >
            <Text style={[styles.chipText, outcome === o && styles.chipTextOn]}>{o}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.eyebrow}>{t('markets.amount')}</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder={`${BET_MIN_SAT}–${BET_MAX_SAT}`}
        placeholderTextColor={theme.color.textMuted}
      />

      <Text style={styles.eyebrow}>{t('markets.price')}</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="1–99"
        placeholderTextColor={theme.color.textMuted}
      />
      <Text style={styles.hint}>{t('markets.priceHint')}</Text>

      <PrimaryButton
        label={step === 'staking' ? t('markets.staking') : t('markets.betPayCta', { sats: String(amountSat) })}
        onPress={onBet}
        loading={step === 'staking'}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Text style={styles.hint}>{t('markets.stakeNote')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  question: { fontFamily: theme.font.label.fontFamily, fontSize: 15, lineHeight: 20, color: theme.color.text, marginBottom: theme.space.md },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.lg, marginBottom: theme.space.sm },
  chips: { flexDirection: 'row', gap: theme.space.sm },
  chip: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingVertical: theme.space.md },
  chipOn: { borderColor: theme.color.accent },
  chipText: { fontFamily: theme.font.label.fontFamily, fontSize: 15, color: theme.color.textMuted },
  chipTextOn: { color: theme.color.accent },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 15,
    color: theme.color.text,
  },
  hint: { fontFamily: theme.font.body.fontFamily, fontSize: 12, lineHeight: 17, color: theme.color.textMuted, marginTop: theme.space.sm },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.md, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.lg, paddingHorizontal: theme.space.xl },
  doneTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 18, color: theme.color.text },
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 14, lineHeight: 20, color: theme.color.textMuted, textAlign: 'center' },
});
