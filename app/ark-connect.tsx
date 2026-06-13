// Ark / Arkade connect (4th custody mode, self-sovereign L2). Mirrors spark-connect:
// one-time risk acknowledgment → optional "unique password" (BIP39 passphrase on the
// DEDICATED Ark seed, minted into the biometric vault by provisionArk). Gated on
// ARK_READY until the real @arkade-os/sdk lands behind a device checkpoint — the
// rung is visible but cannot strand a user on a dead wallet.
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, SecondaryButton, theme } from '@/ui';
import { provisionArk, activateArk, ARK_READY } from '@/wallet';
import { t } from '@/i18n';

type Step = 'risk-ack' | 'password' | 'connecting';

export default function ArkConnect(): React.ReactElement {
  const [step, setStep] = useState<Step>('risk-ack');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onConnect = async () => {
    if (!ARK_READY) return; // gated until the @arkade-os/sdk device checkpoint
    setErr(null);
    setStep('connecting');
    try {
      const config = await provisionArk({ password: password || undefined });
      activateArk(config);
      router.replace('/(tabs)');
    } catch {
      setErr(t('arkConnect.err'));
      setStep('password');
    }
  };

  if (step === 'risk-ack') {
    return (
      <ScreenScaffold title={t('arkConnect.title')} scroll>
        <View style={styles.expRow}>
          <Feather name="alert-triangle" size={16} color={theme.color.accent} />
          <Text style={styles.expText}>{t('onboarding.experimental')}</Text>
        </View>
        <Text style={styles.riskTitle}>{t('arkConnect.riskTitle')}</Text>
        <Text style={styles.riskBody}>{t('arkConnect.riskBody')}</Text>
        <PrimaryButton label={t('sparkConnect.ack')} onPress={() => setStep('password')} />
        <View style={styles.spacer} />
        <SecondaryButton label={t('sparkConnect.back')} onPress={() => router.back()} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title={t('arkConnect.title')} scroll>
      <Text style={styles.riskBody}>{t('arkConnect.passwordHint')}</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={t('sparkConnect.passwordLabel')}
        placeholderTextColor={theme.color.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      {ARK_READY ? (
        <PrimaryButton label={t('arkConnect.connect')} onPress={onConnect} loading={step === 'connecting'} />
      ) : (
        <View style={styles.notReady}>
          <Feather name="clock" size={16} color={theme.color.textMuted} />
          <Text style={styles.notReadyText}>{t('arkConnect.notReady')}</Text>
        </View>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  expRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.color.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs,
    marginBottom: theme.space.lg,
  },
  expText: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.accent },
  riskTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 17, color: theme.color.text, marginBottom: theme.space.md },
  riskBody: { fontFamily: theme.font.body.fontFamily, fontSize: 14, lineHeight: 20, color: theme.color.textMuted, marginBottom: theme.space.xl },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.body.fontFamily,
    fontSize: 14,
    color: theme.color.text,
    marginBottom: theme.space.lg,
  },
  notReady: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, justifyContent: 'center', paddingVertical: theme.space.md },
  notReadyText: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.textMuted },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.md, textAlign: 'center' },
  spacer: { height: theme.space.md },
});
