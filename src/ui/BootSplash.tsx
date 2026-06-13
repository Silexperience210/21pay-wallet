// Futuristic boot screen for 21pay.
// Energy Ring: a glowing ring spins around the 21pay badge while particles rise
// from the bottom. The ring fills progressively as the wallet rehydrates.
// Skia + Reanimated, collapses to a static logo under reduced motion.
import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Blur,
  Path,
  Skia,
  Text,
  useFont,
  Image,
  useImage,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

const LOGO_SIZE = 160;
const RING_RADIUS = 130;
const RING_STROKE = 5;
const PARTICLE_COUNT = 24;

function Particle({ index }: { index: number }): React.ReactElement | null {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      p.value = 0.5;
      return;
    }
    const delay = index * 120;
    p.value = withRepeat(
      withTiming(1, { duration: 2200 + (index % 3) * 400, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [reduced, p, index]);

  const cx = useDerivedValue(() => {
    'worklet';
    const base = width * 0.15 + ((index * 37) % (width * 0.7));
    const wobble = Math.sin((p.value + index) * Math.PI * 2) * 18;
    return base + wobble;
  });

  const cy = useDerivedValue(() => {
    'worklet';
    return height - p.value * (height * 0.75);
  });

  const radius = useDerivedValue(() => {
    'worklet';
    return 2 + (1 - p.value) * 3;
  });

  const opacity = useDerivedValue(() => {
    'worklet';
    return (1 - p.value) * 0.55;
  });

  const color = index % 3 === 0 ? theme.color.orbOrange : index % 3 === 1 ? theme.color.orbViolet : theme.color.orbPink;

  return (
    <Circle cx={cx} cy={cy} r={radius} color={color} opacity={opacity}>
      <Blur blur={3} />
    </Circle>
  );
}

export function BootSplash({ progress }: { progress?: number }): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  const fillProgress = useSharedValue(progress ?? 0);
  const logoImage = useImage(require('../../assets/splash-logo.png'));

  useEffect(() => {
    if (progress !== undefined) {
      fillProgress.value = withTiming(progress, { duration: 300, easing: Easing.linear });
    }
  }, [progress, fillProgress]);

  useEffect(() => {
    if (reduced) {
      spin.value = 0.25;
      pulse.value = 0.5;
      return;
    }
    spin.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduced, spin, pulse]);

  const centerX = width / 2;
  const centerY = height / 2;

  const rotate = useDerivedValue(() => {
    'worklet';
    return spin.value * Math.PI * 2;
  });

  const glowRadius = useDerivedValue(() => {
    'worklet';
    return 36 + pulse.value * 10;
  });

  const glowOpacity = useDerivedValue(() => {
    'worklet';
    return 0.22 + pulse.value * 0.1;
  });

  const ringPath = useDerivedValue(() => {
    'worklet';
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + fillProgress.value * Math.PI * 2;
    const path = Skia.Path.Make();
    path.addArc(
      { x: centerX - RING_RADIUS, y: centerY - RING_RADIUS, width: RING_RADIUS * 2, height: RING_RADIUS * 2 },
      (startAngle * 180) / Math.PI,
      ((endAngle - startAngle) * 180) / Math.PI,
    );
    return path;
  });

  const rotatingRingPath = useDerivedValue(() => {
    'worklet';
    const startAngle = -Math.PI / 2 + rotate.value;
    const sweep = Math.PI * 1.35;
    const path = Skia.Path.Make();
    path.addArc(
      { x: centerX - RING_RADIUS, y: centerY - RING_RADIUS, width: RING_RADIUS * 2, height: RING_RADIUS * 2 },
      (startAngle * 180) / Math.PI,
      (sweep * 180) / Math.PI,
    );
    return path;
  });

  return (
    <View style={styles.root}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Ambient glow behind logo */}
        <Circle cx={centerX} cy={centerY} r={glowRadius} color={theme.color.accent} opacity={glowOpacity}>
          <Blur blur={40} />
        </Circle>

        {/* Energy ring fill */}
        <Path path={ringPath} color={theme.color.accent} style="stroke" strokeWidth={RING_STROKE} opacity={0.9}>
          <Blur blur={4} />
        </Path>

        {/* Spinning accent ring */}
        <Path path={rotatingRingPath} color={theme.color.orbPink} style="stroke" strokeWidth={RING_STROKE - 1} opacity={0.75}>
          <Blur blur={6} />
        </Path>

        {/* Rising particles */}
        <Group>
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
            <Particle key={i} index={i} />
          ))}
        </Group>

        {/* Logo image */}
        {logoImage && (
          <Image
            image={logoImage}
            x={centerX - LOGO_SIZE / 2}
            y={centerY - LOGO_SIZE / 2}
            width={LOGO_SIZE}
            height={LOGO_SIZE}
            fit="contain"
          />
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
});
