// ONBD-05: always-on custody indicator. Label/dot derive ONLY from custodyBadge(store) —
// a single source. Renders nothing if no backend is active. Never shows a secret.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useWalletStore, custodyBadge } from '../core/state';
import { theme } from './theme';

export function CustodyBadge(): React.ReactElement | null {
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const badge = custodyBadge({ activeBackendKind });
  if (!badge) return null;
  return (
    <View style={styles.pill} accessibilityLabel={`Custody: ${badge.label}`}>
      <View style={styles.dot} />
      <Text style={styles.label}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.cardFill,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: theme.color.accent },
  label: { fontFamily: theme.font.mono.fontFamily, fontSize: 12, color: theme.color.text },
});
