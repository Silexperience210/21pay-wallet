// Positions + settlement (MARKET-04): every stored position, checked against the
// oracle's latest VERIFIED attestation. Winners redeem (l_X) and the sats are
// melted back into the in-app wallet; INVALID/silence opens the refund branch (b)
// after the locktime. All failures render inline (MARKET-07 layer 3).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, SecondaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import type { OracleAttestation } from './lib/hunch';
import { fetchAttestation } from './lib/oracle';
import { loadPositions, type BetPosition } from './positions';
import { settlePosition, refundPosition } from './betFlow';
import { HUNCH_RELAYS } from './marketsConfig';

interface Row {
  position: BetPosition;
  attestation: OracleAttestation | null;
}

export function PositionsScreen(): React.ReactElement {
  const caps = useSectionCapabilities();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const positions = await loadPositions(caps);
      const out: Row[] = [];
      for (const position of positions) {
        let attestation: OracleAttestation | null = null;
        if (position.status === 'open') {
          attestation = await fetchAttestation(HUNCH_RELAYS, position.oracle, position.marketId).catch(() => null);
        }
        out.push({ position, attestation });
      }
      setRows(out);
    } catch {
      setErr(t('markets.backendErr'));
    }
  }, [caps]);

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

  const onSettle = async (row: Row) => {
    if (!row.attestation) return;
    setBusyId(row.position.id);
    setErr(null);
    setNotice(null);
    try {
      const result = await settlePosition(caps, row.position, row.attestation);
      if (result.kind === 'won') setNotice(t('markets.won', { sats: String(result.redeemedSat) }));
      else if (result.kind === 'refunded') setNotice(t('markets.refunded', { sats: String(result.redeemedSat) }));
      else if (result.kind === 'lost') setNotice(t('markets.lost'));
      else setNotice(t('markets.refundLater'));
      await load();
    } catch {
      setErr(t('markets.settleErr'));
    } finally {
      setBusyId(null);
    }
  };

  const onRefund = async (position: BetPosition) => {
    setBusyId(position.id);
    setErr(null);
    setNotice(null);
    try {
      const sats = await refundPosition(caps, position);
      setNotice(t('markets.refunded', { sats: String(sats) }));
      await load();
    } catch {
      setErr(t('markets.settleErr'));
    } finally {
      setBusyId(null);
    }
  };

  const now = Math.floor(Date.now() / 1000);

  return (
    <ScreenScaffold title={t('markets.positions')}>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.accent} />}
        contentContainerStyle={styles.list}
      >
        {loading ? (
          <Text style={styles.lead}>{t('markets.loading')}</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.lead}>{t('markets.noPositions')}</Text>
        ) : (
          rows.map(({ position, attestation }) => {
            const refundOpen = position.status === 'lost' && now >= position.locktime;
            return (
              <View key={position.id} style={styles.card}>
                <Text style={styles.cardQuestion}>{position.question}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardOutcome}>{position.outcome}</Text>
                  <Text style={styles.cardSats}>{position.amountSat.toLocaleString('fr-FR')} sats</Text>
                  <Text style={styles.cardStatus}>{t(`markets.status.${position.status}` as const)}</Text>
                </View>
                {position.status === 'won' && position.redeemedSat != null ? (
                  <View style={styles.wonRow}>
                    <Feather name="award" size={14} color={theme.color.success} />
                    <Text style={styles.wonText}>+{position.redeemedSat.toLocaleString('fr-FR')} sats</Text>
                  </View>
                ) : null}
                {position.status === 'open' && attestation ? (
                  <PrimaryButton
                    label={
                      attestation.outcome === position.outcome
                        ? t('markets.redeemCta')
                        : t('markets.settleCta', { outcome: attestation.outcome })
                    }
                    onPress={() => onSettle({ position, attestation })}
                    loading={busyId === position.id}
                  />
                ) : null}
                {position.status === 'open' && !attestation ? (
                  <Text style={styles.hint}>{t('markets.awaiting')}</Text>
                ) : null}
                {refundOpen ? (
                  <SecondaryButton label={t('markets.refundCta')} onPress={() => onRefund(position)} />
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.space.md, paddingBottom: theme.space.xl },
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 14, color: theme.color.textMuted, textAlign: 'center', marginTop: theme.space.xl },
  notice: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.success, marginBottom: theme.space.sm, textAlign: 'center' },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginBottom: theme.space.sm, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.space.lg, gap: theme.space.sm },
  cardQuestion: { fontFamily: theme.font.label.fontFamily, fontSize: 14, lineHeight: 19, color: theme.color.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
  cardOutcome: { fontFamily: theme.font.mono.fontFamily, fontSize: 13, color: theme.color.accent },
  cardSats: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.text },
  cardStatus: { flex: 1, textAlign: 'right', fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.textMuted },
  wonRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  wonText: { fontFamily: theme.font.mono.fontFamily, fontSize: 13, color: theme.color.success },
  hint: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted },
});
