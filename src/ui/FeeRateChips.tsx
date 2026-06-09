// On-chain fee-rate selector: slow / med / fast. Selected chip fills hairline→cream
// (NOT accent — orange is rationed to the primary CTA). Snap under reduced-motion.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from './theme';

export interface FeeRate {
  label: string;
  satPerVb: number;
}

export function FeeRateChips({
  value,
  onChange,
  rates,
}: {
  value: number;
  onChange: (satPerVb: number) => void;
  rates: FeeRate[];
}): React.ReactElement {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {rates.map((r) => {
        const selected = r.satPerVb === value;
        return (
          <Pressable
            key={r.label}
            onPress={() => onChange(r.satPerVb)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${r.label}, ${r.satPerVb} sats per vByte`}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{r.label}</Text>
            <Text style={[styles.rate, selected && styles.rateSelected]}>{r.satPerVb} sat/vB</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.space.sm },
  chip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.cardFill,
  },
  chipSelected: { backgroundColor: theme.color.surface, borderColor: theme.color.text },
  label: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.textMuted },
  labelSelected: { color: theme.color.text },
  rate: { fontFamily: theme.font.mono.fontFamily, fontSize: 11, color: theme.color.textMuted, marginTop: 2 },
  rateSelected: { color: theme.color.textMuted },
});
