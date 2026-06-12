// Market detail (MARKET-02/05 + D-07): question/criteria, implied odds from the
// kind-38888 book, and the ORACLE TRANSPARENCY block — announce status, aggregated
// reputation, and the settlement banner with the VISIBLE Schnorr attestation sig
// (Hunch CLAUDE.md: never hidden behind clicks, shown at bet time).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import {
  KIND_MARKET,
  KIND_ORDER,
  marketId,
  parseMarketEvent,
  parseOrderEvent,
  type Market,
  type Order,
  type OracleAnnounce,
  type OracleAttestation,
  type ReputationSummary,
  aggregateReputation,
} from './lib/hunch';
import { verifyEvent } from './lib/verify';
import { queryRelays } from './lib/relay';
import { buildOrderBook, impliedOdds, type ImpliedOdds } from './lib/orderbook';
import { fetchAnnounce, fetchAttestation, fetchReputation } from './lib/oracle';
import { HUNCH_RELAYS } from './marketsConfig';

function short(hex: string, n = 12): string {
  return hex.length > n ? `${hex.slice(0, n)}…` : hex;
}

export function MarketDetailScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ creator: string; d: string }>();
  const creator = String(params.creator ?? '');
  const d = String(params.d ?? '');
  const id = marketId(creator, d);

  const [market, setMarket] = useState<Market | null>(null);
  const [odds, setOdds] = useState<ImpliedOdds | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [announce, setAnnounce] = useState<OracleAnnounce | null>(null);
  const [attestation, setAttestation] = useState<OracleAttestation | null>(null);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      // The market event itself (#d IS relay-indexed).
      const evs = await queryRelays(HUNCH_RELAYS, { kinds: [KIND_MARKET], authors: [creator], '#d': [d], limit: 5 });
      // Replaceable: relays can disagree — keep the NEWEST verified version.
      let m: Market | null = null;
      let mAt = -1;
      for (const ev of evs) {
        if (!verifyEvent(ev)) continue;
        const parsed = parseMarketEvent(ev);
        if (parsed && parsed.id === id && ev.created_at > mAt) {
          m = parsed;
          mAt = ev.created_at;
        }
      }
      if (!m) {
        setErr(t('markets.notFound'));
        return;
      }
      setMarket(m);
      // Order book (kind 38888 carries d == market id) + oracle reads, in parallel.
      const [orderEvents, ann, att, reps] = await Promise.all([
        queryRelays(HUNCH_RELAYS, { kinds: [KIND_ORDER], '#d': [id], limit: 500 }),
        fetchAnnounce(HUNCH_RELAYS, m.oracle, id),
        fetchAttestation(HUNCH_RELAYS, m.oracle, id),
        fetchReputation(HUNCH_RELAYS, m.oracle, 'oracle'),
      ]);
      const orders: Order[] = [];
      for (const ev of orderEvents) {
        if (!verifyEvent(ev)) continue;
        const o = parseOrderEvent(ev);
        if (o && o.market === id) orders.push(o);
      }
      const book = buildOrderBook(orders, id);
      setOdds(impliedOdds(book));
      setOrderCount(orders.length);
      setAnnounce(ann);
      setAttestation(att);
      setReputation(aggregateReputation(reps));
    } catch {
      setErr(t('markets.backendErr'));
    }
  }, [creator, d, id]);

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

  const open = market != null && market.expiry > Math.floor(Date.now() / 1000);
  const canBet = open && announce != null && attestation == null;

  return (
    <ScreenScaffold title={t('markets.detail.title')} scroll>
      {loading ? <Text style={styles.lead}>{t('markets.loading')}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {market ? (
        <>
          <Text style={styles.question}>{market.content.question}</Text>
          {market.content.resolution_criteria ? (
            <Text style={styles.criteria}>{market.content.resolution_criteria}</Text>
          ) : null}

          {/* Odds (MARKET-02) */}
          <View style={styles.oddsRow}>
            <View style={styles.oddsCell}>
              <Text style={styles.oddsValue}>{odds ? `${odds.yes}%` : '—'}</Text>
              <Text style={styles.oddsLabel}>YES</Text>
            </View>
            <View style={styles.oddsCell}>
              <Text style={styles.oddsValue}>{odds ? `${odds.no}%` : '—'}</Text>
              <Text style={styles.oddsLabel}>NO</Text>
            </View>
            <View style={styles.oddsCell}>
              <Text style={styles.oddsValue}>{orderCount}</Text>
              <Text style={styles.oddsLabel}>{t('markets.orders')}</Text>
            </View>
          </View>
          {!odds ? <Text style={styles.hint}>{t('markets.noOdds')}</Text> : null}

          {/* Oracle transparency (D-07 / MARKET-05) */}
          <Text style={styles.eyebrow}>{t('markets.oracle')}</Text>
          <View style={styles.oracleCard}>
            <Text style={styles.mono}>{short(market.oracle, 24)}</Text>
            <Text style={styles.oracleLine}>
              {reputation
                ? t('markets.repLine', { avg: String(reputation.avg), count: String(reputation.count) })
                : t('markets.repNone')}
            </Text>
            <Text style={styles.oracleLine}>
              {announce ? t('markets.nonceCommitted') : t('markets.nonceMissing')}
            </Text>
          </View>

          {/* Settlement banner — attestation sig VISIBLE (MARKET-05) */}
          {attestation ? (
            <View style={styles.settleCard}>
              <View style={styles.settleHead}>
                <Feather name="check-circle" size={16} color={theme.color.success} />
                <Text style={styles.settleTitle}>
                  {t('markets.settled', { outcome: attestation.outcome })}
                </Text>
              </View>
              <Text style={styles.settleSigLabel}>{t('markets.attestationSig')}</Text>
              <Text style={styles.mono}>{attestation.signature}</Text>
              {attestation.evidence ? <Text style={styles.oracleLine}>{attestation.evidence}</Text> : null}
            </View>
          ) : null}

          {canBet ? (
            <PrimaryButton
              label={t('markets.betCta')}
              onPress={() =>
                router.push({ pathname: '/(sections)/markets/bet', params: { creator, d } })
              }
            />
          ) : !attestation ? (
            <Text style={styles.hint}>{open ? t('markets.noBetNoNonce') : t('markets.expired')}</Text>
          ) : null}
        </>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 14, color: theme.color.textMuted, textAlign: 'center', marginVertical: theme.space.md },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginBottom: theme.space.sm },
  question: { fontFamily: theme.font.heading.fontFamily, fontSize: 18, lineHeight: 24, color: theme.color.text, marginBottom: theme.space.sm },
  criteria: { fontFamily: theme.font.body.fontFamily, fontSize: 13, lineHeight: 18, color: theme.color.textMuted, marginBottom: theme.space.lg },
  oddsRow: { flexDirection: 'row', justifyContent: 'space-around', borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingVertical: theme.space.lg, marginBottom: theme.space.sm },
  oddsCell: { alignItems: 'center', gap: 2 },
  oddsValue: { fontFamily: theme.font.mono.fontFamily, fontSize: 20, color: theme.color.text },
  oddsLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 11, color: theme.color.textMuted },
  hint: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, textAlign: 'center', marginBottom: theme.space.md },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.lg, marginBottom: theme.space.sm },
  oracleCard: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.space.lg, gap: theme.space.xs, marginBottom: theme.space.lg },
  oracleLine: { fontFamily: theme.font.body.fontFamily, fontSize: 12, lineHeight: 17, color: theme.color.textMuted },
  mono: { fontFamily: theme.font.mono.fontFamily, fontSize: 11, color: theme.color.text },
  settleCard: { borderWidth: 1, borderColor: theme.color.success, borderRadius: theme.radius.md, padding: theme.space.lg, gap: theme.space.sm, marginBottom: theme.space.lg },
  settleHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  settleTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.text },
  settleSigLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 11, color: theme.color.textMuted },
});
