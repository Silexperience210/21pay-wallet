// Market detail (MARKET-02/05 + D-07): question/criteria, implied odds from the
// kind-38888 book, and the ORACLE TRANSPARENCY block — announce status, aggregated
// reputation, and the settlement banner with the VISIBLE Schnorr attestation sig
// (Hunch CLAUDE.md: never hidden behind clicks, shown at bet time).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, SecondaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import { publishToRelays } from './lib/relay';
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
  type MintAnnounce,
  type Dispute,
  aggregateReputation,
  summarizeResolution,
} from './lib/hunch';
import { verifyEvent } from './lib/verify';
import { queryRelays } from './lib/relay';
import { buildOrderBook, impliedOdds, anchorProb, type ImpliedOdds } from './lib/orderbook';
import { fetchAnnounce, fetchAttestation, fetchReputation } from './lib/oracle';
import { fetchMintAnnounce } from './lib/mint';
import { fetchDisputes } from './lib/disputes';
import { buildReputationTemplate, buildDisputeTemplate, buildDeleteTemplate } from './lib/build';
import { HUNCH_RELAYS } from './marketsConfig';
import { shareUrlForMarket } from './marketsConfig';

const CLAIM_CATEGORIES = ['oracle_misread', 'source_unavailable', 'ambiguous_criteria', 'premature', 'other'] as const;

function short(hex: string, n = 12): string {
  return hex.length > n ? `${hex.slice(0, n)}…` : hex;
}

export function MarketDetailScreen(): React.ReactElement {
  const caps = useSectionCapabilities();
  const params = useLocalSearchParams<{ creator: string; d: string }>();
  const creator = String(params.creator ?? '');
  const d = String(params.d ?? '');
  const id = marketId(creator, d);

  const [market, setMarket] = useState<Market | null>(null);
  const [odds, setOdds] = useState<ImpliedOdds | null>(null);
  // AMM-anchored P(YES) as a percent — shown when the book has no two-sided demand
  // (Lot A: no market is ever un-priced; defaults to 50 on an empty book).
  const [anchorYes, setAnchorYes] = useState(50);
  const [orderCount, setOrderCount] = useState(0);
  const [announce, setAnnounce] = useState<OracleAnnounce | null>(null);
  const [attestation, setAttestation] = useState<OracleAttestation | null>(null);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [mintAnnounce, setMintAnnounce] = useState<MintAnnounce | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Rate-oracle form (HIP-5 kind 30891 — reputation is WRITE-able, not just read).
  const [rateScore, setRateScore] = useState('');
  const [rateNote, setRateNote] = useState('');
  const [rateBusy, setRateBusy] = useState(false);
  const [rateMsg, setRateMsg] = useState<string | null>(null);
  // Raise-dispute form (HIP-1 kind 30890 — only meaningful once settled).
  const [claim, setClaim] = useState<(typeof CLAIM_CATEGORIES)[number]>('oracle_misread');
  const [evidence, setEvidence] = useState('');
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState<string | null>(null);
  // Creator-only NIP-09 delete.
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  // Oracle mode — myPubkey from the prompt-free section-store cache (populated the
  // first time any flow unlocks the identity; never prompts on a simple page view).
  const [myPubkey, setMyPubkey] = useState<string | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<'YES' | 'NO' | 'INVALID' | null>(null);
  const [oracleBusy, setOracleBusy] = useState(false);

  useEffect(() => {
    caps.store.get('markets.myPubkey').then(setMyPubkey).catch(() => {});
  }, [caps]);

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
      // Order book (kind 38888 carries d == market id) + oracle/mint/dispute reads, parallel.
      const [orderEvents, ann, att, reps, mint, disp] = await Promise.all([
        queryRelays(HUNCH_RELAYS, { kinds: [KIND_ORDER], '#d': [id], limit: 500 }),
        fetchAnnounce(HUNCH_RELAYS, m.oracle, id),
        fetchAttestation(HUNCH_RELAYS, m.oracle, id),
        fetchReputation(HUNCH_RELAYS, m.oracle, 'oracle'),
        fetchMintAnnounce(HUNCH_RELAYS, m.mint).catch(() => null),
        fetchDisputes(HUNCH_RELAYS, id).catch(() => []),
      ]);
      const orders: Order[] = [];
      for (const ev of orderEvents) {
        if (!verifyEvent(ev)) continue;
        const o = parseOrderEvent(ev);
        if (o && o.market === id) orders.push(o);
      }
      const book = buildOrderBook(orders, id);
      setOdds(impliedOdds(book));
      setAnchorYes(Math.round(anchorProb(book) * 100));
      setOrderCount(orders.length);
      setAnnounce(ann);
      setAttestation(att);
      setReputation(aggregateReputation(reps));
      setMintAnnounce(mint);
      setDisputes(disp);
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
  // Mint transparency: does the market's mint list this oracle? (null = no announce.)
  const oracleBacked =
    market && mintAnnounce ? mintAnnounce.supportedOracles.includes(market.oracle.toLowerCase()) : null;

  const onRate = async () => {
    if (!market || rateBusy) return;
    const n = Number(rateScore);
    if (!Number.isInteger(n) || n < -100 || n > 100) {
      setRateMsg(t('markets.rate.invalid'));
      return;
    }
    setRateBusy(true);
    setRateMsg(null);
    try {
      const template = buildReputationTemplate({
        subject: market.oracle,
        scope: 'oracle',
        score: n,
        market: market.id,
        note: rateNote.trim() || undefined,
      });
      const signed = await caps.signer.signHunchEvent(template);
      if (!(await publishToRelays(HUNCH_RELAYS, signed))) throw new Error('relay');
      setRateScore('');
      setRateNote('');
      setRateMsg(t('markets.rate.done'));
      await load();
    } catch {
      setRateMsg(t('markets.rate.err'));
    } finally {
      setRateBusy(false);
    }
  };

  const onRaiseDispute = async () => {
    if (!market || !attestation || disputeBusy) return;
    setDisputeBusy(true);
    setDisputeMsg(null);
    try {
      const template = buildDisputeTemplate({
        market: market.id,
        attestation: attestation.eventId,
        claim,
        evidence: evidence.trim() || undefined,
      });
      const signed = await caps.signer.signHunchEvent(template);
      if (!(await publishToRelays(HUNCH_RELAYS, signed))) throw new Error('relay');
      setEvidence('');
      setDisputeMsg(t('markets.disputes.done'));
      await load();
    } catch {
      setDisputeMsg(t('markets.disputes.err'));
    } finally {
      setDisputeBusy(false);
    }
  };

  const onShare = async () => {
    if (!market) return;
    const url = shareUrlForMarket(market.id);
    try {
      await Share.share({ message: `${market.content.question}\n${url}`, url });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const onDelete = () => {
    if (!market) return;
    Alert.alert(t('markets.delete.confirmTitle'), t('markets.delete.confirmBody'), [
      { text: t('markets.delete.cancel'), style: 'cancel' },
      {
        text: t('markets.delete.confirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setDeleteMsg(null);
          try {
            const signed = await caps.signer.signHunchEvent(buildDeleteTemplate(market.creator, market.d));
            if (!(await publishToRelays(HUNCH_RELAYS, signed))) throw new Error('relay');
            setDeleteMsg(t('markets.delete.done'));
            setTimeout(() => router.back(), 900);
          } catch {
            setDeleteMsg(t('markets.delete.err'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const isCreator = market != null && myPubkey != null && market.creator === myPubkey;

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
          <Text style={styles.resolvesBy}>
            {t('markets.resolvesBy')}: {summarizeResolution(market.resolutionSpec)}
          </Text>

          {/* Share + creator delete (NIP-09) */}
          <View style={styles.actionRow}>
            <Pressable onPress={onShare} hitSlop={8} accessibilityRole="button" style={styles.actionBtn}>
              <Feather name="share-2" size={14} color={theme.color.accent} />
              <Text style={styles.actionText}>{t('markets.share')}</Text>
            </Pressable>
            {isCreator ? (
              <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" style={styles.actionBtn} disabled={deleting}>
                <Feather name={deleting ? 'loader' : 'trash-2'} size={14} color={theme.color.destructive} />
                <Text style={[styles.actionText, styles.actionTextDanger]}>{t('markets.delete.cta')}</Text>
              </Pressable>
            ) : null}
          </View>
          {deleteMsg ? <Text style={styles.formMsg}>{deleteMsg}</Text> : null}

          {/* Odds (MARKET-02) — real book odds when two-sided, else AMM 50/50 anchor */}
          <View style={styles.oddsRow}>
            <View style={styles.oddsCell}>
              <Text style={styles.oddsValue}>{`${odds ? odds.yes : anchorYes}%`}</Text>
              <Text style={styles.oddsLabel}>YES</Text>
            </View>
            <View style={styles.oddsCell}>
              <Text style={styles.oddsValue}>{`${odds ? odds.no : 100 - anchorYes}%`}</Text>
              <Text style={styles.oddsLabel}>NO</Text>
            </View>
            <View style={styles.oddsCell}>
              <Text style={styles.oddsValue}>{orderCount}</Text>
              <Text style={styles.oddsLabel}>{t('markets.orders')}</Text>
            </View>
          </View>
          {!odds ? <Text style={styles.hint}>{t('markets.oddsAmm')}</Text> : null}

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

          {/* Mint transparency (HIP-3 reserves — non-optional per Hunch CLAUDE.md) */}
          <Text style={styles.eyebrow}>{t('markets.mint.title')}</Text>
          <View style={styles.oracleCard}>
            <Text style={styles.mono}>{short(market.mint, 36)}</Text>
            <Text style={styles.oracleLine}>
              {mintAnnounce?.reservesProof
                ? `${t('markets.mint.reserves')}: ${mintAnnounce.reservesProof}`
                : t('markets.mint.noReserves')}
            </Text>
            {oracleBacked !== null ? (
              <Text style={[styles.oracleLine, oracleBacked ? styles.okLine : styles.warnLine]}>
                {oracleBacked ? t('markets.mint.backedYes') : t('markets.mint.backedNo')}
              </Text>
            ) : null}
          </View>

          {/* Rate this oracle (HIP-5 kind 30891) — reputation is contributable, not read-only */}
          <Text style={styles.eyebrow}>{t('markets.rate.title')}</Text>
          <View style={styles.rateRow}>
            <TextInput
              style={[styles.input, styles.scoreInput]}
              value={rateScore}
              onChangeText={(v) => setRateScore(v.replace(/[^0-9-]/g, ''))}
              keyboardType="numbers-and-punctuation"
              placeholder={t('markets.rate.scorePh')}
              placeholderTextColor={theme.color.textMuted}
            />
            <TextInput
              style={[styles.input, styles.flex1]}
              value={rateNote}
              onChangeText={setRateNote}
              placeholder={t('markets.rate.notePh')}
              placeholderTextColor={theme.color.textMuted}
            />
          </View>
          <SecondaryButton label={rateBusy ? `${t('markets.rate.cta')}…` : t('markets.rate.cta')} onPress={onRate} />
          {rateMsg ? <Text style={styles.formMsg}>{rateMsg}</Text> : null}

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

          {/* Disputes (HIP-1 kind 30890) — oracle accountability, raisable once settled */}
          <Text style={styles.eyebrow}>{t('markets.disputes.title')}</Text>
          {disputes.length === 0 ? (
            <Text style={styles.hint}>{t('markets.disputes.none')}</Text>
          ) : (
            disputes.map((dp) => (
              <View key={dp.disputer} style={styles.disputeItem}>
                <Text style={styles.disputeClaim}>
                  {dp.claim} · {short(dp.disputer, 10)}
                </Text>
                {dp.evidence ? <Text style={styles.oracleLine}>{dp.evidence}</Text> : null}
              </View>
            ))
          )}
          {attestation ? (
            <View style={styles.disputeForm}>
              <View style={styles.claimRow}>
                {CLAIM_CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setClaim(c)}
                    accessibilityRole="button"
                    style={[styles.claimChip, claim === c && styles.claimChipOn]}
                  >
                    <Text style={[styles.claimChipText, claim === c && styles.claimChipTextOn]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={evidence}
                onChangeText={setEvidence}
                placeholder={t('markets.disputes.evidencePh')}
                placeholderTextColor={theme.color.textMuted}
              />
              <SecondaryButton label={disputeBusy ? `${t('markets.disputes.cta')}…` : t('markets.disputes.cta')} onPress={onRaiseDispute} />
            </View>
          ) : (
            <Text style={styles.hint}>{t('markets.disputes.needSettled')}</Text>
          )}
          {disputeMsg ? <Text style={styles.formMsg}>{disputeMsg}</Text> : null}

          {/* ── ORACLE MODE — visible only to THIS market's oracle ── */}
          {myPubkey && market.oracle === myPubkey && !attestation ? (
            <View style={styles.oraclePanel}>
              <View style={styles.oraclePanelHead}>
                <Feather name="radio" size={16} color="#7850ff" />
                <Text style={styles.oraclePanelTitle}>{t('markets.oracle.panel')}</Text>
              </View>
              {!announce ? (
                <>
                  <Text style={styles.oraclePanelBody}>{t('markets.oracle.announceBody')}</Text>
                  <PrimaryButton
                    label={t('markets.oracle.announceCta')}
                    loading={oracleBusy}
                    onPress={async () => {
                      setOracleBusy(true);
                      setErr(null);
                      try {
                        const { nonce } = await caps.signer.oracleAnnounce(id);
                        const signed = await caps.signer.signHunchEvent({
                          kind: 88,
                          tags: [['market', id], ['nonce', nonce]],
                          content: 'committed via 21pay wallet',
                        });
                        if (!(await publishToRelays(HUNCH_RELAYS, signed))) throw new Error('relay');
                        await load();
                      } catch {
                        setErr(t('markets.createPublishErr'));
                      } finally {
                        setOracleBusy(false);
                      }
                    }}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.oraclePanelBody}>{t('markets.oracle.attestBody')}</Text>
                  <View style={styles.outcomeRow}>
                    {(['YES', 'NO', 'INVALID'] as const).map((o) => (
                      <SecondaryButton
                        key={o}
                        label={pendingOutcome === o ? `● ${o}` : o}
                        onPress={() => setPendingOutcome(o)}
                      />
                    ))}
                  </View>
                  {pendingOutcome ? (
                    <>
                      <Text style={styles.oracleWarn}>
                        {t('markets.oracle.confirmWarn', { outcome: pendingOutcome })}
                      </Text>
                      <PrimaryButton
                        label={t('markets.oracle.confirmCta', { outcome: pendingOutcome })}
                        loading={oracleBusy}
                        onPress={async () => {
                          setOracleBusy(true);
                          setErr(null);
                          try {
                            const { signature } = await caps.signer.oracleAttest(id, pendingOutcome);
                            const signed = await caps.signer.signHunchEvent({
                              kind: 89,
                              tags: [['market', id], ['outcome', pendingOutcome], ['sig', signature]],
                              content: '',
                            });
                            if (!(await publishToRelays(HUNCH_RELAYS, signed))) throw new Error('relay');
                            setPendingOutcome(null);
                            await load();
                          } catch (e) {
                            setErr(
                              e instanceof Error && /already attested/.test(e.message)
                                ? t('markets.oracle.equivocation')
                                : t('markets.createPublishErr'),
                            );
                          } finally {
                            setOracleBusy(false);
                          }
                        }}
                      />
                    </>
                  ) : null}
                </>
              )}
            </View>
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
  criteria: { fontFamily: theme.font.body.fontFamily, fontSize: 13, lineHeight: 18, color: theme.color.textMuted, marginBottom: theme.space.sm },
  resolvesBy: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, marginBottom: theme.space.md },
  actionRow: { flexDirection: 'row', gap: theme.space.lg, marginBottom: theme.space.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.accent },
  actionTextDanger: { color: theme.color.destructive },
  oddsRow: { flexDirection: 'row', justifyContent: 'space-around', borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingVertical: theme.space.lg, marginBottom: theme.space.sm },
  oddsCell: { alignItems: 'center', gap: 2 },
  oddsValue: { fontFamily: theme.font.mono.fontFamily, fontSize: 20, color: theme.color.text },
  oddsLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 11, color: theme.color.textMuted },
  hint: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, textAlign: 'center', marginBottom: theme.space.md },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.lg, marginBottom: theme.space.sm },
  oracleCard: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.space.lg, gap: theme.space.xs, marginBottom: theme.space.lg },
  oracleLine: { fontFamily: theme.font.body.fontFamily, fontSize: 12, lineHeight: 17, color: theme.color.textMuted },
  okLine: { color: theme.color.success },
  warnLine: { color: theme.color.destructive },
  mono: { fontFamily: theme.font.mono.fontFamily, fontSize: 11, color: theme.color.text },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.body.fontFamily,
    fontSize: 13,
    color: theme.color.text,
  },
  flex1: { flex: 1 },
  rateRow: { flexDirection: 'row', gap: theme.space.sm, marginBottom: theme.space.sm },
  scoreInput: { width: 96, fontFamily: theme.font.mono.fontFamily },
  formMsg: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, marginTop: theme.space.sm, textAlign: 'center' },
  disputeItem: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.space.md, gap: 2, marginBottom: theme.space.sm },
  disputeClaim: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.accent },
  disputeForm: { gap: theme.space.sm, marginTop: theme.space.sm },
  claimRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs },
  claimChip: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.pill, paddingHorizontal: theme.space.md, paddingVertical: theme.space.xs },
  claimChipOn: { borderColor: theme.color.accent },
  claimChipText: { fontFamily: theme.font.body.fontFamily, fontSize: 11, color: theme.color.textMuted },
  claimChipTextOn: { color: theme.color.accent },
  settleCard: { borderWidth: 1, borderColor: theme.color.success, borderRadius: theme.radius.md, padding: theme.space.lg, gap: theme.space.sm, marginBottom: theme.space.lg },
  settleHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  settleTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.text },
  settleSigLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 11, color: theme.color.textMuted },
  oraclePanel: {
    borderWidth: 1,
    borderColor: 'rgba(120,80,255,0.45)',
    backgroundColor: 'rgba(120,80,255,0.06)',
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    gap: theme.space.md,
    marginTop: theme.space.xl,
  },
  oraclePanelHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  oraclePanelTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.text },
  oraclePanelBody: { fontFamily: theme.font.body.fontFamily, fontSize: 13, lineHeight: 18, color: theme.color.textMuted },
  outcomeRow: { gap: theme.space.sm },
  oracleWarn: {
    fontFamily: theme.font.label.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    color: theme.color.destructive,
  },
});
