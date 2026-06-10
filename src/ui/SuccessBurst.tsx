// One-shot "payment landed" burst: a swelling core glow, an expanding shockwave ring,
// and rays of energy flung outward — fired the instant a payment settles. Skia +
// Reanimated, plays once on `play`. Collapses to a static glow under reduced-motion.
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Circle, Group, Blur } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

const SIZE = 280;
const RAYS = 16;
const C = SIZE / 2;
const MAX_DIST = SIZE * 0.42;

function Ray({ p, angle }: { p: SharedValue<number>; angle: number }): React.ReactElement {
  const cx = useDerivedValue(() => {
    'worklet';
    return C + Math.cos(angle) * MAX_DIST * p.value;
  });
  const cy = useDerivedValue(() => {
    'worklet';
    return C + Math.sin(angle) * MAX_DIST * p.value;
  });
  const r = useDerivedValue(() => {
    'worklet';
    return 6 * (1 - p.value) + 1.5;
  });
  const opacity = useDerivedValue(() => {
    'worklet';
    return (1 - p.value) * 0.95;
  });
  return (
    <Circle cx={cx} cy={cy} r={r} color={theme.color.success} opacity={opacity}>
      <Blur blur={2} />
    </Circle>
  );
}

export function SuccessBurst({ play }: { play: boolean }): React.ReactElement {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (!play || reduced) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) });
  }, [play, reduced, p]);

  const ringR = useDerivedValue(() => {
    'worklet';
    return 20 + (MAX_DIST - 20) * p.value;
  });
  const ringOpacity = useDerivedValue(() => {
    'worklet';
    return (1 - p.value) * 0.6;
  });
  const coreGlow = useDerivedValue(() => {
    'worklet';
    return 26 + 26 * Math.sin(Math.min(p.value, 1) * Math.PI);
  });

  if (reduced) {
    return (
      <Canvas style={styles.canvas}>
        <Circle cx={C} cy={C} r={38} color={theme.color.success} opacity={0.25}>
          <Blur blur={20} />
        </Circle>
      </Canvas>
    );
  }

  return (
    <Canvas style={styles.canvas}>
      <Circle cx={C} cy={C} r={coreGlow} color={theme.color.success} opacity={0.35}>
        <Blur blur={22} />
      </Circle>
      <Circle cx={C} cy={C} r={ringR} color={theme.color.success} opacity={ringOpacity} style="stroke" strokeWidth={3} />
      <Group>
        {Array.from({ length: RAYS }).map((_, i) => (
          <Ray key={i} p={p} angle={(i / RAYS) * Math.PI * 2} />
        ))}
      </Group>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { width: SIZE, height: SIZE },
});
