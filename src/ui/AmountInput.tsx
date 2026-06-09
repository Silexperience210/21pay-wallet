// Big mono sats entry. Integer sats only (never NaN/float). Out-of-range (LNURL
// min/max) shakes + turns the border destructive. Snap under reduced-motion.
import React, { useEffect } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { sanitizeSatInput } from '@/wallet/format';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

export function AmountInput({
  valueSat,
  onChange,
  min,
  max,
  fiatPreview,
}: {
  valueSat: number | null;
  onChange: (sat: number | null) => void;
  min?: number;
  max?: number;
  fiatPreview?: string;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);

  const outOfRange =
    valueSat != null &&
    ((min != null && valueSat < min) || (max != null && valueSat > max));

  useEffect(() => {
    if (outOfRange && !reduced) {
      shake.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [outOfRange, reduced, shake]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  // Strip everything non-digit; empty → null (any-amount). Never produce NaN/float.
  const handleText = (text: string) => onChange(sanitizeSatInput(text));

  return (
    <Animated.View style={animStyle}>
      <View style={[styles.box, outOfRange && styles.boxError]}>
        <TextInput
          value={valueSat == null ? '' : String(valueSat)}
          onChangeText={handleText}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={theme.color.textMuted}
          style={styles.input}
          accessibilityLabel="Amount in satoshis"
        />
        <Text style={styles.unit}>sats</Text>
      </View>
      {fiatPreview ? <Text style={styles.fiat}>{fiatPreview}</Text> : null}
      {outOfRange ? (
        <Text style={styles.range}>
          {min != null && valueSat != null && valueSat < min
            ? `Minimum ${min} sats`
            : `Maximum ${max} sats`}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: theme.space.sm,
    borderBottomWidth: 2,
    borderBottomColor: theme.color.border,
    paddingVertical: theme.space.sm,
  },
  boxError: { borderBottomColor: theme.color.destructive },
  input: {
    fontFamily: theme.font.monoBalance.fontFamily,
    fontSize: 36,
    color: theme.color.text,
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  unit: { fontFamily: theme.font.mono.fontFamily, fontSize: 16, color: theme.color.textMuted },
  fiat: {
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
    marginTop: theme.space.sm,
  },
  range: {
    fontFamily: theme.font.label.fontFamily,
    fontSize: 13,
    color: theme.color.destructive,
    textAlign: 'center',
    marginTop: theme.space.sm,
  },
});
