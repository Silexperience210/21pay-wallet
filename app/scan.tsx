// Fullscreen unified scanner (WALLET-04). Hosts QrScanner, classifies in one pass,
// and hands off into Send PRE-FILLED — it never pays. Unknown codes show a brief
// inline hint and re-arm.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { QrScanner, theme } from '@/ui';
import type { ParsedPayment } from '@/wallet/parse';
import { t } from '@/i18n';

export default function ScanScreen(): React.ReactElement {
  const [hint, setHint] = useState<string | null>(null);

  const onDecode = (parsed: ParsedPayment) => {
    if (parsed.kind === 'unknown') {
      setHint(t('scan.unknown'));
      return;
    }
    setHint(null);
    // Carry the classified payload into Send (consumed by the Send sheet).
    const params: Record<string, string> = { kind: parsed.kind };
    switch (parsed.kind) {
      case 'bolt11':
        params.destination = parsed.invoice;
        break;
      case 'lnurl':
        params.destination = parsed.lnurl;
        break;
      case 'lnaddr':
        params.destination = `${parsed.name}@${parsed.domain}`;
        break;
      case 'bip21':
        params.destination = parsed.lightning ?? parsed.address;
        if (parsed.amountSat != null) params.amountSat = String(parsed.amountSat);
        break;
      case 'onchain':
        params.destination = parsed.address;
        break;
    }
    router.replace({ pathname: '/send', params });
  };

  return (
    <View style={styles.root}>
      <QrScanner onDecode={onDecode} />
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.close}
      >
        <Feather name="x" size={26} color={theme.color.text} />
      </Pressable>
      {hint ? (
        <View style={styles.hintWrap} pointerEvents="none">
          <Text style={styles.hint}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  close: { position: 'absolute', top: 56, left: theme.space.xl },
  hintWrap: { position: 'absolute', top: 120, left: 0, right: 0, alignItems: 'center' },
  hint: {
    fontFamily: theme.font.label.fontFamily,
    fontSize: 14,
    color: theme.color.text,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
});
