// Destination entry with live type detection. The parent passes `detected` (the
// kind from parsePaymentInput); this shows a mono type chip + a paste button.
import React from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AnimatePresence, MotiView } from 'moti';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import type { PaymentInputKind } from '@/wallet/parse';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

const KIND_LABEL: Record<PaymentInputKind, string | null> = {
  bolt11: 'BOLT11',
  lnaddr: 'LN ADDRESS',
  lnurl: 'LNURL',
  bip21: 'BIP21',
  onchain: 'ON-CHAIN',
  unknown: null,
};

export function DestinationField({
  value,
  onChange,
  detected,
}: {
  value: string;
  onChange: (v: string) => void;
  detected: PaymentInputKind;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const label = KIND_LABEL[detected];

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      onChange(text.trim());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Invoice, LN address, LNURL or on-chain address"
          placeholderTextColor={theme.color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          style={styles.input}
          accessibilityLabel="Payment destination"
        />
        <Pressable onPress={paste} hitSlop={8} accessibilityRole="button" accessibilityLabel="Paste from clipboard" style={styles.paste}>
          <Feather name="clipboard" size={18} color={theme.color.textMuted} />
        </Pressable>
      </View>
      <AnimatePresence>
        {label ? (
          <MotiView
            key={label}
            from={{ opacity: reduced ? 1 : 0, translateY: reduced ? 0 : -4 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'timing', duration: 180 }}
            style={styles.chip}
          >
            <Text style={styles.chipLabel}>{label}</Text>
          </MotiView>
        ) : null}
      </AnimatePresence>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.sm,
    backgroundColor: theme.color.cardFill,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  input: { flex: 1, fontFamily: theme.font.mono.fontFamily, fontSize: 14, color: theme.color.text, minHeight: 44, padding: 0 },
  paste: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: 4,
  },
  chipLabel: { fontFamily: theme.font.mono.fontFamily, fontSize: 12, color: theme.color.textMuted, letterSpacing: 1 },
});
