// NFC direct payment — real radio (react-native-nfc-manager) + synchronized
// energy-transfer visualization.
//   SEND    → read a Lightning tag/card (NDEF) and pay the BOLT11 it carries.
//   RECEIVE → write a fresh invoice onto a programmable tag.
// Animation is driven by the actual NFC session lifecycle. NFC ops only work on a
// physical NFC device (verified at the device checkpoint).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EnergyTransfer, PrimaryButton, SecondaryButton, theme } from '@/ui';
import { useWallet } from '@/wallet';
import { parsePaymentInput } from '@/wallet/parse';
import { useWalletStore } from '@/core/state';
import { isSupported, readPaymentUri, writePaymentUri, cancel } from '@/nfc';

type Phase = 'idle' | 'waiting' | 'transferring' | 'done' | 'error';
type Role = 'send' | 'receive';

export default function NfcScreen(): React.ReactElement {
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role>('send');
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState('Hold a Lightning tag to the back of your phone.');

  useEffect(() => {
    isSupported().then(setSupported).catch(() => setSupported(false));
    return () => {
      cancel().catch(() => {});
    };
  }, []);

  const active = phase === 'waiting' || phase === 'transferring';

  const runSend = async () => {
    if (!activeBackendKind) {
      setPhase('error');
      setMsg('Create a wallet first.');
      return;
    }
    setPhase('waiting');
    setMsg('Hold the Lightning tag to your phone…');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const raw = await readPaymentUri();
      const parsed = parsePaymentInput(raw);
      const invoice =
        parsed.kind === 'bolt11' ? parsed.invoice : parsed.kind === 'bip21' ? parsed.lightning : undefined;
      if (!invoice) {
        setPhase('error');
        setMsg('That tag has no payable Lightning invoice.');
        return;
      }
      setPhase('transferring');
      setMsg('Transferring energy…');
      await useWallet().payInvoice(invoice);
      setPhase('done');
      setMsg('Paid. Your sats moved.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setPhase('error');
      setMsg((e as Error)?.message ?? 'NFC payment failed.');
    }
  };

  const runReceive = async () => {
    if (!activeBackendKind) {
      setPhase('error');
      setMsg('Create a wallet first.');
      return;
    }
    setPhase('waiting');
    setMsg('Creating an invoice, then hold a writable tag…');
    try {
      const { bolt11 } = await useWallet().createInvoice(1000, '21pay NFC');
      setPhase('transferring');
      await writePaymentUri(`lightning:${bolt11}`);
      setPhase('done');
      setMsg('Invoice written to the tag.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setPhase('error');
      setMsg((e as Error)?.message ?? 'Could not write the tag.');
    }
  };

  const reset = () => {
    cancel().catch(() => {});
    setPhase('idle');
    setMsg('Hold a Lightning tag to the back of your phone.');
  };

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

        {phase === 'idle' && supported !== false ? (
          <View style={styles.roleRow}>
            {(['send', 'receive'] as Role[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={[styles.chip, role === r && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: role === r }}
              >
                <Feather
                  name={r === 'send' ? 'arrow-up-right' : 'arrow-down-left'}
                  size={16}
                  color={role === r ? '#050505' : theme.color.textMuted}
                />
                <Text style={[styles.chipLabel, role === r && styles.chipLabelActive]}>
                  {r === 'send' ? 'Send' : 'Receive'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={[styles.status, phase === 'error' && { color: theme.color.destructive }]}>
            {supported === false ? 'This device has no NFC.' : msg}
          </Text>
          {supported === false ? (
            <SecondaryButton label="Close" onPress={() => router.back()} />
          ) : phase === 'idle' ? (
            <PrimaryButton
              label={role === 'send' ? 'Tap to pay' : 'Write invoice to tag'}
              onPress={role === 'send' ? runSend : runReceive}
            />
          ) : phase === 'done' ? (
            <PrimaryButton label="Done" onPress={() => router.back()} />
          ) : phase === 'error' ? (
            <PrimaryButton label="Try again" onPress={reset} />
          ) : (
            <SecondaryButton label="Cancel" onPress={reset} />
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
  chip: {
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
  chipActive: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  chipLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.textMuted },
  chipLabelActive: { color: '#050505' },
  footer: { paddingHorizontal: theme.space.xl, gap: theme.space.lg },
  status: {
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
});
