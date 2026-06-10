// name@21pay claim field with live validation + availability feedback. Validation is
// synchronous (plan-01 validator); availability is supplied by the parent (it owns the
// network probe + LNbits cfg). Green check when free, destructive shake when invalid/taken.
import React, { useEffect } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AnimatePresence, MotiView } from 'moti';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { validateLnAddressHandle, LN_ADDRESS_DOMAIN } from '@/wallet/identity';
import { t } from '@/i18n';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

export function AddressClaimField({
  name,
  onChange,
  available,
  checking,
}: {
  name: string;
  onChange: (v: string) => void;
  available?: boolean | null;
  checking?: boolean;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);
  const validation = validateLnAddressHandle(name);

  const invalid = name.length > 0 && !validation.valid;
  const taken = validation.valid && available === false;
  const free = validation.valid && available === true;
  const error = invalid || taken;

  useEffect(() => {
    if (error && !reduced) {
      shake.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [error, reduced, shake]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const hint = invalid
    ? validation.reason
    : checking
      ? t('identity.checking')
      : taken
        ? t('identity.taken')
        : free
          ? t('identity.available')
          : null;

  return (
    <Animated.View style={animStyle}>
      <View style={[styles.box, error && styles.boxError, free && styles.boxFree]}>
        <TextInput
          value={name}
          onChangeText={(t) => onChange(t.toLowerCase().replace(/\s/g, ''))}
          placeholder="yourname"
          placeholderTextColor={theme.color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Choose your Lightning address name"
        />
        <Text style={styles.domain}>@{LN_ADDRESS_DOMAIN}</Text>
        <View style={styles.statusIcon}>
          <AnimatePresence>
            {free ? (
              <MotiView
                key="ok"
                from={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'timing', duration: 160 }}
              >
                <Feather name="check" size={18} color={theme.color.success} />
              </MotiView>
            ) : null}
          </AnimatePresence>
        </View>
      </View>
      {hint ? (
        <Text style={[styles.hint, error && styles.hintError, free && styles.hintFree]}>{hint}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    backgroundColor: theme.color.cardFill,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  boxError: { borderColor: theme.color.destructive },
  boxFree: { borderColor: theme.color.success },
  input: { flex: 1, fontFamily: theme.font.mono.fontFamily, fontSize: 16, color: theme.color.text, padding: 0 },
  domain: { fontFamily: theme.font.mono.fontFamily, fontSize: 16, color: theme.color.textMuted },
  statusIcon: { width: 22, alignItems: 'center' },
  hint: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.sm },
  hintError: { color: theme.color.destructive },
  hintFree: { color: theme.color.success },
});
