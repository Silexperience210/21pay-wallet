// NFC direct payment — real radio (react-native-nfc-manager) + HCE (react-native-hce)
// + synchronized energy-transfer visualization.
//   SEND    → reader mode: read a Lightning tag/card/phone (NDEF) and pay the BOLT11.
//   RECEIVE → HCE: emulate a tag carrying a fresh invoice (choose the amount) so the
//             other party taps to pay (no physical tag — phone-to-phone with SEND).
//   CARD    → HCE: present an LNURL-withdraw link so a terminal PULLS the payment
//             (BoltCard-style tap-to-pay). Needs the LNbits withdraw extension.
// Emulation auto-stops after a tap-session timeout so we never serve a stale link.
// NFC ops only work on a physical NFC device (verified at the device checkpoint).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EnergyTransfer, PrimaryButton, SecondaryButton, AmountInput, theme } from '@/ui';
import { useWallet } from '@/wallet';
import { parsePaymentInput } from '@/wallet/parse';
import { useWalletStore } from '@/core/state';
import { isSupported, readPaymentUri, cancel, startEmulation, stopEmulation } from '@/nfc';
import { t } from '@/i18n';

type Phase = 'idle' | 'waiting' | 'transferring' | 'done' | 'error';
type Role = 'send' | 'receive' | 'card';

// A tap session shouldn't keep emulating forever — drop the HCE tag after this.
const SESSION_TIMEOUT_MS = 120_000;

export default function NfcScreen(): React.ReactElement {
  const wallet = (() => {
    try {
      return useWallet();
    } catch {
      return null;
    }
  })();
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role>('send');
  const [amountSat, setAmountSat] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState(t('nfc.idle'));
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = () => {
    if (sessionTimer.current) clearTimeout(sessionTimer.current);
    sessionTimer.current = null;
  };

  useEffect(() => {
    isSupported().then(setSupported).catch(() => setSupported(false));
    return () => {
      clearSession();
      cancel().catch(() => {});
      stopEmulation().catch(() => {});
    };
  }, []);

  const active = phase === 'waiting' || phase === 'transferring';
  const emulationRole: 'send' | 'receive' = role === 'send' ? 'send' : 'receive';

  // Start a HCE emulation with a session timeout that drops the tag if never read.
  const emulate = async (uri: string, doneMsg: string) => {
    setPhase('transferring');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await startEmulation(uri, () => {
      clearSession();
      setPhase('done');
      setMsg(doneMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      stopEmulation().catch(() => {});
    });
    sessionTimer.current = setTimeout(() => {
      stopEmulation().catch(() => {});
      setPhase('error');
      setMsg(t('nfc.expired'));
    }, SESSION_TIMEOUT_MS);
  };

  const runSend = async () => {
    if (!activeBackendKind || !wallet) {
      setPhase('error');
      setMsg(t('nfc.createWalletFirst'));
      return;
    }
    setPhase('waiting');
    setMsg(t('nfc.holdTag'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const raw = await readPaymentUri();
      const parsed = parsePaymentInput(raw);
      const invoice =
        parsed.kind === 'bolt11' ? parsed.invoice : parsed.kind === 'bip21' ? parsed.lightning : undefined;
      if (!invoice) {
        setPhase('error');
        setMsg(t('nfc.noInvoice'));
        return;
      }
      setPhase('transferring');
      setMsg(t('nfc.transferring'));
      await wallet.payInvoice(invoice);
      setPhase('done');
      setMsg(t('nfc.paid'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setPhase('error');
      setMsg((e as Error)?.message ?? t('nfc.payFailed'));
    }
  };

  const runReceive = async () => {
    if (!activeBackendKind || !wallet) {
      setPhase('error');
      setMsg(t('nfc.createWalletFirst'));
      return;
    }
    setPhase('waiting');
    setMsg(t('nfc.creatingInvoice'));
    try {
      const { bolt11 } = await wallet.createInvoice(amountSat ?? 0, '21pay NFC');
      setMsg(t('nfc.holdOther'));
      await emulate(`lightning:${bolt11}`, t('nfc.delivered'));
    } catch (e) {
      setPhase('error');
      setMsg((e as Error)?.message ?? t('nfc.emuFailed'));
      stopEmulation().catch(() => {});
    }
  };

  const runCard = async () => {
    if (!activeBackendKind || !wallet) {
      setPhase('error');
      setMsg(t('nfc.createWalletFirst'));
      return;
    }
    if (!wallet.getWithdrawLink) {
      setPhase('error');
      setMsg(t('nfc.emuFailed'));
      return;
    }
    setPhase('waiting');
    setMsg(t('nfc.creatingInvoice'));
    try {
      const { lnurl } = await wallet.getWithdrawLink(amountSat ?? 0);
      setMsg(t('nfc.holdOther'));
      await emulate(lnurl.toUpperCase(), t('nfc.delivered'));
    } catch (e) {
      setPhase('error');
      setMsg((e as Error)?.message ?? t('nfc.emuFailed'));
      stopEmulation().catch(() => {});
    }
  };

  const reset = () => {
    clearSession();
    cancel().catch(() => {});
    stopEmulation().catch(() => {});
    setPhase('idle');
    setMsg(t('nfc.idle'));
  };

  const onPrimary = role === 'send' ? runSend : role === 'receive' ? runReceive : runCard;
  const primaryLabel = role === 'send' ? t('nfc.tapToPay') : t('nfc.tapToReceive');
  const roleIcon: Record<Role, keyof typeof Feather.glyphMap> = {
    send: 'arrow-up-right',
    receive: 'arrow-down-left',
    card: 'credit-card',
  };

  return (
    <View style={styles.root}>
      <EnergyTransfer role={emulationRole} active={active} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('nfc.close')}>
            <Feather name="x" size={26} color={theme.color.text} />
          </Pressable>
          <Text style={styles.title}>{t('nfc.title')}</Text>
          <View style={{ width: 26 }} />
        </View>

        {phase === 'idle' && supported !== false ? (
          <View style={styles.controls}>
            <View style={styles.roleRow}>
              {(['send', 'receive', 'card'] as Role[]).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.chip, role === r && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: role === r }}
                >
                  <Feather name={roleIcon[r]} size={16} color={role === r ? '#050505' : theme.color.textMuted} />
                  <Text style={[styles.chipLabel, role === r && styles.chipLabelActive]}>
                    {r === 'send' ? t('nfc.send') : r === 'receive' ? t('nfc.receive') : 'Card'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {role !== 'send' ? (
              <View style={styles.amountWrap}>
                <Text style={styles.amountLabel}>{t('nfc.amountLabel')}</Text>
                <AmountInput valueSat={amountSat} onChange={setAmountSat} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={[styles.status, phase === 'error' && { color: theme.color.destructive }]}>
            {supported === false ? t('nfc.noNfc') : msg}
          </Text>
          {supported === false ? (
            <SecondaryButton label={t('nfc.close')} onPress={() => router.back()} />
          ) : phase === 'idle' ? (
            <PrimaryButton label={primaryLabel} onPress={onPrimary} />
          ) : phase === 'done' ? (
            <PrimaryButton label={t('nfc.done')} onPress={() => router.back()} />
          ) : phase === 'error' ? (
            <PrimaryButton label={t('nfc.tryAgain')} onPress={reset} />
          ) : (
            <SecondaryButton label={t('nfc.cancel')} onPress={reset} />
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
  controls: { gap: theme.space.xl, marginTop: theme.space.lg },
  roleRow: { flexDirection: 'row', gap: theme.space.sm, justifyContent: 'center' },
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
  amountWrap: { paddingHorizontal: theme.space.xl, gap: theme.space.sm },
  amountLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, textAlign: 'center' },
  footer: { paddingHorizontal: theme.space.xl, gap: theme.space.lg },
  status: {
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
});
