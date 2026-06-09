// Display-only ≈ fiat line. Hidden when the rate feed failed (rate 0). WALLET-07.
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { formatFiat, satsToFiat } from '../wallet/format';
import { theme } from './theme';

export function FiatLine({
  sats,
  ratePerSat,
  currency = 'EUR',
}: {
  sats: number;
  ratePerSat: number;
  currency?: string;
}): React.ReactElement | null {
  if (!ratePerSat) return null; // never block the screen on a failed feed
  return <Text style={styles.fiat}>{formatFiat(satsToFiat(sats, ratePerSat), currency)}</Text>;
}

const styles = StyleSheet.create({
  fiat: {
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
});
