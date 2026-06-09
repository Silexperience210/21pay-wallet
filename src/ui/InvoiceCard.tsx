// A shareable payment QR (Skia) + its copyable string. Used for both a BOLT11
// invoice and an on-chain address (kind switches only the copy label). Renders ONLY
// shareable data — never a key, preimage, or mnemonic.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-skia';
import { MotiView } from 'moti';
import { theme } from './theme';
import { CopyField } from './CopyField';

const QR_SIZE = 220;

export function InvoiceCard({
  data,
  kind,
}: {
  data: string;
  kind: 'bolt11' | 'onchain';
}): React.ReactElement {
  const label = kind === 'bolt11' ? 'Lightning invoice' : 'On-chain address';
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 350 }}
      style={styles.wrap}
    >
      <View style={styles.qrCard}>
        <QRCode value={data} size={QR_SIZE} color={theme.color.bg} padding={0} />
      </View>
      <CopyField value={data} label={label} />
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch', gap: theme.space.lg },
  qrCard: {
    alignSelf: 'center',
    backgroundColor: theme.color.text, // cream plate → ink QR for reliable contrast
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
  },
});
