// NWC pairing (ONBD-02 / D-01): scan the node's QR OR paste the
// nostr+walletconnect:// URI, name the connection, connect. Validation is
// fail-closed via parseNwcUri BEFORE anything is stored; the budget is whatever the
// NODE enforces (D-03) — shown as guidance, never locally enforced.
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold, PrimaryButton, SecondaryButton, QrScanner, theme } from '@/ui';
import { parseNwcUri, createAndActivateNwc } from '@/wallet';
import { t } from '@/i18n';

export default function NwcConnect(): React.ReactElement {
  const [uri, setUri] = useState('');
  const [name, setName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tryAccept = (raw: string): boolean => {
    try {
      parseNwcUri(raw); // fail-closed validation (T-04-25)
      setUri(raw.trim());
      setErr(null);
      setScanning(false);
      return true;
    } catch {
      setErr(t('nwcConnect.invalid'));
      return true; // consumed — it's never a payment QR in this screen
    }
  };

  const onConnect = async () => {
    setErr(null);
    let pretty = name.trim();
    try {
      const parsed = parseNwcUri(uri);
      if (!pretty) pretty = `${parsed.walletPubkey.slice(0, 8)}…`;
    } catch {
      setErr(t('nwcConnect.invalid'));
      return;
    }
    setBusy(true);
    try {
      await createAndActivateNwc(uri.trim(), pretty);
      router.replace('/custody');
    } catch {
      setErr(t('nwcConnect.connectErr'));
    } finally {
      setBusy(false);
    }
  };

  if (scanning) {
    return (
      <View style={styles.scanRoot}>
        <QrScanner onRaw={tryAccept} onDecode={() => setErr(t('nwcConnect.invalid'))} />
        <View style={styles.scanFooter}>
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <SecondaryButton label={t('nwcConnect.stopScan')} onPress={() => setScanning(false)} />
        </View>
      </View>
    );
  }

  return (
    <ScreenScaffold title={t('nwcConnect.title')} scroll>
      <Text style={styles.lead}>{t('nwcConnect.lead')}</Text>
      <SecondaryButton label={t('nwcConnect.scan')} onPress={() => setScanning(true)} />
      <Text style={styles.or}>{t('nwcConnect.or')}</Text>
      <TextInput
        style={styles.input}
        value={uri}
        onChangeText={setUri}
        placeholder="nostr+walletconnect://…"
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('nwcConnect.namePlaceholder')}
        placeholderTextColor={theme.color.textMuted}
        autoCorrect={false}
      />
      <PrimaryButton label={t('nwcConnect.connect')} onPress={onConnect} loading={busy} />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Text style={styles.budgetNote}>{t('nwcConnect.budgetNote')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: theme.font.body.fontFamily,
    fontSize: 15,
    lineHeight: 21,
    color: theme.color.textMuted,
    marginBottom: theme.space.lg,
  },
  or: {
    fontFamily: theme.font.label.fontFamily,
    fontSize: 12,
    color: theme.color.textMuted,
    textAlign: 'center',
    marginVertical: theme.space.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.body.fontFamily,
    fontSize: 14,
    color: theme.color.text,
    marginBottom: theme.space.md,
  },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.md, textAlign: 'center' },
  budgetNote: {
    fontFamily: theme.font.body.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    color: theme.color.textMuted,
    marginTop: theme.space.xl,
  },
  scanRoot: { flex: 1, backgroundColor: theme.color.bg },
  scanFooter: {
    position: 'absolute',
    bottom: theme.space['3xl'],
    left: theme.space.xl,
    right: theme.space.xl,
    gap: theme.space.md,
  },
});
