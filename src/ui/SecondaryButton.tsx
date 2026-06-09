// Secondary CTA — cream/hairline, NOT accent (orange is rationed to PrimaryButton).
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      onPressIn={() => {
        if (!reduced) {
          opacity.value = withTiming(0.7, { duration: 80 });
          scale.value = withTiming(0.97, { duration: 80 });
        }
      }}
      onPressOut={() => {
        if (!reduced) {
          opacity.value = withTiming(1, { duration: 80 });
          scale.value = withTiming(1, { duration: 80 });
        }
      }}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.btn, animStyle]}
    >
      <Text style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    minWidth: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.cardFill,
  },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: theme.color.text },
});
