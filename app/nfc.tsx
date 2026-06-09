// NFC direct payment — "tap to pay" with a synchronized energy-transfer visualization.
// The on-screen animation is live; the NFC radio handshake (react-native-nfc-manager /
// HCE) is a follow-up — here a simulated handshake drives the same flow end-to-end.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EnergyTransfer, PrimaryButton, SecondaryButton, theme } from '@/ui';

type Phase = 'idle' | 'searching' | 'transferring' | 'done';
type Role = 'send' | 'receive';

const STATUS: Record<Phase, string> = {
  idle: 'Hold two phones back-to-back to transfer.',
  searching: 'Searching for a nearby device…',
  transferring: 'Transferring energy…',
  done: 'Done. Your sats moved.',
};

export default function NfcScreen(): React.ReactElement {
  const [role, setRole] = useState<Role>('send');
  const [phase, setPhase] = useState<Phase>('idle');

  const start = () => {
    setPhase('searching');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => setPhase('transferring'), 900);
    setTimeout(() => {
      setPhase('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 3200);
  };

  const active = phase === 'searching' || phase === 'transferring';

  return (
    <View style={styles.root}>
      <EnergyTransfer role={role} active={active} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Feather name="x" size={26} color={theme.color.text} />
          </Pressable>
          <Text style={styles.title}>NFC Pay</Text>
          <View style={{ width: 26 }} />
        </View>

        {phase === 'idle' ? (
          <View style={styles.roleRow}>
            {(['send', 'receive'] as Role[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={[styles.roleChip, role === r && styles.roleChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: role === r }}
              >
                <Feather
                  name={r === 'send' ? 'arrow-up-right' : 'arrow-down-left'}
                  size={16}
                  color={role === r ? '#050505' : theme.color.textMuted}
                />
                <Text style={[styles.roleLabel, role === r && styles.roleLabelActive]}>
                  {r === 'send' ? 'Send' : 'Receive'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.status}>{STATUS[phase]}</Text>
          {phase === 'idle' ? (
            <PrimaryButton label={role === 'send' ? 'Tap to send' : 'Tap to receive'} onPress={start} />
          ) : phase === 'done' ? (
            <PrimaryButton label="Done" onPress={() => router.back()} />
          ) : (
            <SecondaryButton label="Cancel" onPress={() => setPhase('idle')} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  safe: { flex: 1, justifyContent: 'space-between' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.sm,
  },
  title: { fontFamily: theme.font.heading.fontFamily, fontSize: 18, color: theme.color.text },
  roleRow: { flexDirection: 'row', gap: theme.space.md, justifyContent: 'center', marginTop: theme.space.lg },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.cardFill,
  },
  roleChipActive: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  roleLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.textMuted },
  roleLabelActive: { color: '#050505' },
  footer: { paddingHorizontal: theme.space.xl, gap: theme.space.lg },
  status: {
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
});
