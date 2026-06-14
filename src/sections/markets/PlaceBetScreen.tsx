// Place-bet screen (MARKET-03): pick a side from the AMM odds panel + a stake → ONE
// explicit CTA that (1) pays the mint deposit invoice from the in-app wallet, (2) mints
// proofs P2PK-locked to L_X, (3) publishes the Core-signed kind-38888 order. The AMM
// (LMSR) quotes a live price anchored on the order book (50/50 on an empty book) so no
// market is ever un-bettable and the order posts at a sensible price by default. Never
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
  KIND_ORDER,
  marketId,
  parseMarketEvent,
  parseOrderEvent,
  type Market,
  type Order,
  type OracleAnnounce,
} from './lib/hunch';
import { verifyEvent } from './lib/verify';
import { queryRelays } from './lib/relay';
import { fetchAnnounce } from './lib/oracle';
import { buildOrderBook, anchorProb } from './lib/orderbook';
import { quoteBet, DEFAULT_DEPTH } from './lib/amm';
import { placeBet } from './betFlow';
import { HUNCH_RELAYS, BET_MIN_SAT, BET_MAX_SAT } from './marketsConfig';

type Step = 'form' | 'staking' | 'done';

const clampPrice = (p: number) => Math.min(99, Math.max(1, Math.round(p)));

export function PlaceBetScreen(): React.ReactElement {
  const caps = useSectionCapabilities();
  const params = useLocalSearchParams<{ creator: string; d: string }>();
  const creator = String(params.creator ?? '');
  const d = String(params.d ?? '');
  const id = marketId(creator, d);

  const [market, setMarket] = useState<Market | null>(null);
  const [announce, setAnnounce] = useState<OracleAnnounce | null>(null);
  // AMM anchor: P(YES) in 0..1 from the order book, 0.5 on an empty book.
  const [anchor, setAnchor] = useState(0.5);
  const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('1000');
  const [manualPrice, setManualPrice] = useState(false);
  const [price, setPrice] = useState('50');
  const [step, setStep] = useState<Step>('form');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const evs = await queryRelays(HUNCH_RELAYS, { kinds: [KIND_MARKET], authors: [creator], '#d': [d], limit: 5 });
      // Replaceable: keep the NEWEST verified version across relays.
      let best: Market | null = null;
      let bestAt = -1;
      for (const ev of evs) {
        if (!verifyEvent(ev)) continue;
        const m = parseMarketEvent(ev);
        if (m && m.id === id && ev.created_at > bestAt) {
          best = m;
          bestAt = ev.created_at;
        }
      }
      if (!best) {
        setErr(t('markets.notFound'));
        return;
      }
      setMarket(best);
      // Announce (nonce, required to bet) + order book (for the AMM anchor), in parallel.
      const [ann, orderEvents] = await Promise.all([
        fetchAnnounce(HUNCH_RELAYS, best.oracle, id),
        queryRelays(HUNCH_RELAYS, { kinds: [KIND_ORDER], '#d': [id], limit: 500 }),
      ]);
      setAnnounce(ann);
      const orders: Order[] = [];
      for (const ev of orderEvents) {
        if (!verifyEvent(ev)) continue;
        const o = parseOrderEvent(ev);
        if (o && o.market === id) orders.push(o);
      }
      setAnchor(anchorProb(buildOrderBook(orders, id)));
    } catch {
      setErr(t('markets.backendErr'));
    }
  }, [creator, d, id]);

  useEffect(() => {
    load();
  }, [load]);

  const amountSat = parseInt(amount, 10) || 0;
  // AMM quotes for both sides at the current stake (pure, cheap to recompute).
  const qYes = quoteBet('YES', amountSat, anchor, DEFAULT_DEPTH);
  const qNo = quoteBet('NO', amountSat, anchor, DEFAULT_DEPTH);
  const sideQuote = outcome === 'YES' ? qYes : qNo;
  const sidePrice = outcome === 'YES' ? qYes.priceYes : qNo.priceNo;
  const ammPrice = clampPrice(sidePrice * 100);
  const manualPriceNum = parseInt(price, 10) || 0;
  const effectivePrice = manualPrice ? manualPriceNum : ammPrice;

  const valid =
    market != null &&
    announce != null &&
    amountSat >= BET_MIN_SAT &&
    amountSat <= BET_MAX_SAT &&
    effectivePrice >= 1 &&
    effectivePrice <= 99;

  const onBet = async () => {
    if (!valid || !market || !announce) return;
    setErr(null);
    setStep('staking');
    try {
      await placeBet(caps, market, announce, { outcome, amountSat, price: effectivePrice });
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

      {/* AMM odds panel — also the side selector (1-click). */}
      <Text style={styles.eyebrow}>{t('markets.amm.title')}</Text>
      <View style={styles.ammRow}>
        {(['YES', 'NO'] as const).map((o) => {
          const p = o === 'YES' ? qYes.priceYes : qNo.priceNo;
          return (
            <Pressable
              key={o}
              onPress={() => setOutcome(o)}
              accessibilityRole="button"
              style={[styles.ammCell, outcome === o && styles.ammCellOn]}
            >
              <Text style={[styles.ammSide, outcome === o && styles.ammSideOn]}>{o}</Text>
              <Text style={[styles.ammPrice, outcome === o && styles.ammPriceOn]}>{Math.round(p * 100)}%</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.ammDetail}>
        {t('markets.amm.detail', {
          avg: String(Math.round(sideQuote.avgPrice * 100)),
          after: String(Math.round(sideQuote.priceAfter * 100)),
        })}
        {amountSat > 0 ? ` · ${t('markets.amm.fee', { fee: String(Math.max(0, Math.round(sideQuote.fee))) })}` : ''}
      </Text>

      <Text style={styles.eyebrow}>{t('markets.amount')}</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder={`${BET_MIN_SAT}–${BET_MAX_SAT}`}
        placeholderTextColor={theme.color.textMuted}
      />

      {/* Order price: auto from the AMM by default, manual override on demand. */}
      {manualPrice ? (
        <>
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
        </>
      ) : (
        <Pressable onPress={() => { setManualPrice(true); setPrice(String(ammPrice)); }} accessibilityRole="button">
          <Text style={styles.manualToggle}>{t('markets.amm.manual')}</Text>
        </Pressable>
      )}

      <Text style={styles.ammNote}>{t('markets.amm.note')}</Text>

      <PrimaryButton
        label={step === 'staking' ? t('markets.staking') : t('markets.betPayCta', { sats: String(amountSat) })}
        onPress={onBet}
        loading={step === 'staking'}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {!announce && market ? <Text style={styles.hint}>{t('markets.noBetNoNonce')}</Text> : null}
      <Text style={styles.hint}>{t('markets.stakeNote')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  question: { fontFamily: theme.font.label.fontFamily, fontSize: 15, lineHeight: 20, color: theme.color.text, marginBottom: theme.space.md },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.lg, marginBottom: theme.space.sm },
  ammRow: { flexDirection: 'row', gap: theme.space.sm },
  ammCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space.md,
  },
  ammCellOn: { borderColor: theme.color.accent, backgroundColor: 'rgba(255,255,255,0.03)' },
  ammSide: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted },
  ammSideOn: { color: theme.color.accent },
  ammPrice: { fontFamily: theme.font.mono.fontFamily, fontSize: 22, color: theme.color.text },
  ammPriceOn: { color: theme.color.text },
  ammDetail: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, marginTop: theme.space.sm },
  ammNote: { fontFamily: theme.font.body.fontFamily, fontSize: 12, lineHeight: 17, color: theme.color.textMuted, marginTop: theme.space.md },
  manualToggle: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.accent, marginTop: theme.space.md },
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
