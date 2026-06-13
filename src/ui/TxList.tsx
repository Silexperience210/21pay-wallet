// Transaction history list. Status conveyed by icon + label + color (never color
// alone). Mono amounts/timestamps. Stagger fade-in, reduced-motion-safe. WALLET-06.
import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { MotiView } from 'moti';
import { Feather } from '@expo/vector-icons';
import { formatSats } from '../wallet/format';
import type { PaymentStatus, WalletTx } from '../wallet';
import { t } from '../i18n';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

const STATUS: Record<PaymentStatus, { color: string; icon: keyof typeof Feather.glyphMap; label: string }> = {
  settled: { color: theme.color.success, icon: 'check-circle', label: 'Settled' },
  pending: { color: theme.color.accent, icon: 'clock', label: 'Pending' },
  failed: { color: theme.color.destructive, icon: 'x-circle', label: 'Failed' },
  expired: { color: theme.color.textMuted, icon: 'slash', label: 'Expired' },
};

export function TxListItem({
  tx,
  index,
  reduced,
}: {
  tx: WalletTx;
  index: number;
  reduced: boolean;
}): React.ReactElement {
  const s = STATUS[tx.status];
  const incoming = tx.direction === 'in';
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: reduced ? 1 : 300, delay: reduced ? 0 : Math.min(index, 8) * 40 }}
      style={styles.row}
    >
      <View style={styles.iconCol}>
        <Feather
          name={incoming ? 'arrow-down-left' : 'arrow-up-right'}
          size={18}
          color={incoming ? theme.color.accent : theme.color.textMuted}
        />
        {tx.source === 'onchain' ? (
          <Feather name="link" size={10} color={theme.color.textMuted} style={styles.sourceIcon} />
        ) : null}
      </View>
      <View style={styles.mid}>
        <Text style={styles.amount}>
          {incoming ? '+' : '-'}
          {formatSats(tx.amountSat)}
        </Text>
        {tx.source === 'onchain' ? (
          <Text style={styles.memo}>
            {tx.direction === 'in' ? t('tx.onchainDeposit') : t('tx.onchainSend')}
          </Text>
        ) : tx.memo ? (
          <Text style={styles.memo}>{tx.memo}</Text>
        ) : null}
        <View style={styles.statusRow}>
          <Feather name={s.icon} size={12} color={s.color} />
          <Text style={[styles.status, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>
      <Text style={styles.time}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
    </MotiView>
  );
}

export function TxList({ txs, compact }: { txs: WalletTx[]; compact?: boolean }): React.ReactElement {
  const reduced = useReducedMotion();
  const data = compact ? txs.slice(0, 5) : txs;
  return (
    <FlatList
      data={data}
      keyExtractor={(t) => t.id}
      renderItem={({ item, index }) => <TxListItem tx={item} index={index} reduced={reduced} />}
      scrollEnabled={!compact}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  iconCol: { alignItems: 'center', justifyContent: 'center' },
  sourceIcon: { marginTop: -2 },
  mid: { flex: 1 },
  amount: { fontFamily: theme.font.mono.fontFamily, fontSize: 15, color: theme.color.text },
  memo: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  status: { fontFamily: theme.font.label.fontFamily, fontSize: 11 },
  time: { fontFamily: theme.font.mono.fontFamily, fontSize: 11, color: theme.color.textMuted },
});
