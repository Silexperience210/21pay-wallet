// A shareable mono string (middle-ellipsized) + a copy button. Copies via
// expo-clipboard with a light haptic; the copy icon morphs to a check for ~1.2s.
// Renders ONLY shareable values (invoices/addresses) — never keys or secrets.
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AnimatePresence, MotiView } from 'moti';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { theme } from './theme';
import { ellipsizeMiddle } from './textFormat';

export function CopyField({ value, label }: { value: string; label: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    await Clipboard.setStringAsync(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Pressable
      onPress={copy}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
    >
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {ellipsizeMiddle(value)}
        </Text>
      </View>
      <View style={styles.icon}>
        <AnimatePresence exitBeforeEnter>
          {copied ? (
            <MotiView
              key="check"
              from={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 160 }}
            >
              <Feather name="check" size={20} color={theme.color.success} />
            </MotiView>
          ) : (
            <MotiView
              key="copy"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 160 }}
            >
              <Feather name="copy" size={20} color={theme.color.textMuted} />
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    backgroundColor: theme.color.cardFill,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  textCol: { flex: 1 },
  label: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.textMuted },
  value: { fontFamily: theme.font.mono.fontFamily, fontSize: 15, color: theme.color.text, marginTop: 2 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
