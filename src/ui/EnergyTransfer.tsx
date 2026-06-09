// NFC "energy transfer" visualization. Orange energy particles stream along a
// vertical conduit between a glowing core and the tap point. Direction mirrors the
// role so a sender (energy leaving) and a receiver (energy arriving) animate in sync.
// Skia + Reanimated; collapses to a static glow under reduced-motion.
import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Circle, Group, Blur } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

const COUNT = 12;

function Particle({
  t,
  phase,
  cx,
  fromY,
  toY,
  r,
}: {
  t: SharedValue<number>;
  phase: number;
  cx: number;
  fromY: number;
  toY: number;
  r: number;
}): React.ReactElement {
  const cy = useDerivedValue(() => {
    'worklet';
    const l = (t.value + phase) % 1;
    return fromY + (toY - fromY) * l;
  });
  const opacity = useDerivedValue(() => {
    'worklet';
    const l = (t.value + phase) % 1;
    return Math.sin(l * Math.PI) * 0.9; // fade in/out along the path
  });
  return (
    <Circle cx={cx} cy={cy} r={r} color={theme.color.orbOrange} opacity={opacity}>
      <Blur blur={3} />
    </Circle>
  );
}

export function EnergyTransfer({
  role,
  active,
}: {
  role: 'send' | 'receive';
  active: boolean;
}): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [active, reduced, t]);

  const cx = width / 2;
  const top = height * 0.2;
  const bottom = height * 0.8;
  // Sender: energy leaves the core (bottom) toward the tap point (top).
  // Receiver: energy arrives from the tap point (top) into the core (bottom).
  const coreY = bottom;
  const tapY = top;
  const fromY = role === 'send' ? coreY : tapY;
  const toY = role === 'send' ? tapY : coreY;

  const coreGlow = useDerivedValue(() => {
    'worklet';
    return active ? 44 + 8 * Math.sin(t.value * Math.PI * 2) : 40;
  });

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* conduit halo */}
      <Group opacity={0.12}>
        <Circle cx={cx} cy={(top + bottom) / 2} r={(bottom - top) / 2} color={theme.color.orbOrange}>
          <Blur blur={48} />
        </Circle>
      </Group>
      {/* the core (energy reservoir) */}
      <Circle cx={cx} cy={coreY} r={coreGlow} color={theme.color.accent} opacity={0.85}>
        <Blur blur={26} />
      </Circle>
      {/* the tap point */}
      <Circle cx={cx} cy={tapY} r={18} color={theme.color.accent} opacity={active ? 0.7 : 0.3}>
        <Blur blur={10} />
      </Circle>
      {active && !reduced
        ? Array.from({ length: COUNT }).map((_, i) => (
            <Particle
              key={i}
              t={t}
              phase={i / COUNT}
              cx={cx + Math.sin(i * 1.7) * 10}
              fromY={fromY}
              toY={toY}
              r={4 + (i % 3)}
            />
          ))
        : null}
    </Canvas>
  );
}
