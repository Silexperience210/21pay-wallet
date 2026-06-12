// The single accent CTA primitive (orange is rationed to this). Magnetic press.
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PrimaryButton({
  label,
  onPress,
  loading,
  destructive,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const bg = destructive ? theme.color.destructive : theme.color.accent;
  return (
    <AnimatedPressable
      onPressIn={() => {
        if (!reduced) scale.value = withSpring(0.96);
      }}
      onPressOut={() => {
        if (!reduced) scale.value = withSpring(1);
      }}
      onPress={onPress}
      disabled={loading || disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.btn, { backgroundColor: bg }, animStyle]}
    >
      {loading ? (
        <ActivityIndicator color="#050505" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    minWidth: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xl,
    shadowColor: theme.color.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#050505' }, // ink on orange ~9:1
});
