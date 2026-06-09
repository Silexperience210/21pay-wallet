// Shared chrome: ink bg + drifting Skia ambient orbs + safe-area + always-on
// CustodyBadge slot + a single content fade-in. Animations collapse under reduced-motion.
import React, { useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Circle, Blur, Group } from '@shopify/react-native-skia';
import { MotiView } from 'moti';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';
import { CustodyBadge } from './CustodyBadge';

export function ScreenScaffold({
  title,
  children,
  scroll,
}: {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
}): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduced, drift]);

  const cy1 = useDerivedValue(() => height * 0.22 + drift.value * 40);
  const cy2 = useDerivedValue(() => height * 0.55 - drift.value * 50);
  const cy3 = useDerivedValue(() => height * 0.82 + drift.value * 30);

  return (
    <View style={styles.root}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group opacity={0.15}>
          <Circle cx={width * 0.25} cy={cy1} r={150} color={theme.color.orbOrange}>
            <Blur blur={60} />
          </Circle>
          <Circle cx={width * 0.8} cy={cy2} r={170} color={theme.color.orbPink}>
            <Blur blur={70} />
          </Circle>
          <Circle cx={width * 0.4} cy={cy3} r={160} color={theme.color.orbViolet}>
            <Blur blur={65} />
          </Circle>
        </Group>
      </Canvas>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.badgeSlot}>
          <CustodyBadge />
        </View>
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: reduced ? 1 : 450 }}
          style={styles.content}
        >
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {scroll ? (
            <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.body}>{children}</View>
          )}
        </MotiView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  safe: { flex: 1 },
  badgeSlot: { paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm, alignItems: 'flex-start' },
  content: { flex: 1, paddingHorizontal: theme.space.xl },
  title: {
    fontFamily: theme.font.display.fontFamily,
    fontSize: theme.font.display.fontSize,
    lineHeight: theme.font.display.lineHeight,
    color: theme.color.text,
    marginVertical: theme.space.lg,
  },
  body: { flex: 1 },
  scrollContent: { paddingBottom: theme.space['3xl'] },
});
