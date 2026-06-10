// WALLET-09 state-machine UI. Renders exactly the four PaymentStatus states — never
// invents a new one. Cross-fades between nodes; success burst + haptic on settled,
// shake + error haptic on failed. Failure paths always reassure "sats are untouched".
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { PaymentStatus } from '@/wallet';
import { t } from '@/i18n';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';
import { PrimaryButton } from './PrimaryButton';
import { SuccessBurst } from './SuccessBurst';

const copyFor = (status: PaymentStatus): { title: string; body: string } => ({
  title: t(`pay.${status}.title`),
  body: t(`pay.${status}.body`),
});

export function PaymentStatusSheet({
  status,
  detail,
  onClose,
}: {
  status: PaymentStatus;
  detail?: string;
  onClose?: () => void;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);
  const copy = copyFor(status);

  useEffect(() => {
    if (status === 'settled') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (status === 'failed' || status === 'expired') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (!reduced) {
        shake.value = withSequence(
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
      }
    }
  }, [status, reduced, shake]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const dotColor =
    status === 'settled'
      ? theme.color.success
      : status === 'pending'
        ? theme.color.accent
        : theme.color.destructive;

  return (
    <Animated.View style={[styles.wrap, animStyle]}>
      {status === 'settled' ? (
        <View style={styles.burst} pointerEvents="none">
          <SuccessBurst play />
        </View>
      ) : null}
      <AnimatePresence exitBeforeEnter>
        <MotiView
          key={status}
          from={{ opacity: 0, scale: reduced ? 1 : 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 220 }}
          style={styles.node}
        >
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </MotiView>
      </AnimatePresence>
      {status !== 'pending' && onClose ? (
        <PrimaryButton label={t('pay.done')} onPress={onClose} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.xl, alignItems: 'stretch' },
  burst: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, alignItems: 'center', justifyContent: 'center' },
  node: { alignItems: 'center', gap: theme.space.md, paddingVertical: theme.space.xl },
  dot: { width: 16, height: 16, borderRadius: 8 },
  title: { fontFamily: theme.font.heading.fontFamily, fontSize: 22, color: theme.color.text },
  body: { fontFamily: theme.font.body.fontFamily, fontSize: 15, color: theme.color.textMuted, textAlign: 'center' },
  detail: { fontFamily: theme.font.mono.fontFamily, fontSize: 14, color: theme.color.text, marginTop: theme.space.sm },
});
