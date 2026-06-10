// Identity tab (WALLET-08, UX-02 anchor): claim a name@21pay Lightning Address with
// live availability/validation, then view it in a copyable card. The claimed address
// is public and persisted in secure-store; NO private key is ever stored or rendered.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  ScreenScaffold,
  PrimaryButton,
  EmptyState,
  AddressClaimField,
  LnAddressCard,
  theme,
} from '@/ui';
import { getActiveCustodialConfig } from '@/wallet';
import {
  validateLnAddressHandle,
  checkLnAddressAvailable,
  claimLnAddress,
} from '@/wallet/identity';
import { getPref, setPref } from '@/core/state';
import { t } from '@/i18n';

const STORE_KEY = 'lnaddress'; // public handle in prefs (NOT a secret)

export default function Identity(): React.ReactElement {
  const [claimed, setClaimed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Restore any previously claimed address (sync prefs read).
  useEffect(() => {
    try {
      setClaimed(getPref(STORE_KEY));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  // Debounced availability probe (validation is synchronous; network only when valid).
  useEffect(() => {
    setAvailable(null);
    if (!validateLnAddressHandle(name).valid) {
      setChecking(false);
      return;
    }
    setChecking(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const cfg = getActiveCustodialConfig();
      if (!cfg) {
        if (!cancelled) setChecking(false);
        return;
      }
      const free = await checkLnAddressAvailable(name, cfg);
      if (!cancelled) {
        setAvailable(free);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name]);

  const onClaim = async () => {
    const cfg = getActiveCustodialConfig();
    if (!cfg) {
      setErr(t('identity.createWalletFirst'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { lnAddress } = await claimLnAddress(name, cfg);
      setPref(STORE_KEY, lnAddress);
      setClaimed(lnAddress);
    } catch {
      setErr(t('identity.claimErr'));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return <ScreenScaffold title={t('identity.title')}><View /></ScreenScaffold>;
  }

  if (claimed) {
    return (
      <ScreenScaffold title={t('identity.title')} scroll>
        <LnAddressCard lnAddress={claimed} />
      <Pressable
        onPress={() => router.push('/backup')}
        style={styles.seedRow}
        accessibilityRole="button"
      >
        <Feather name="key" size={16} color={theme.color.accent} />
        <Text style={styles.seedRowText}>{t('identity.viewSeed')}</Text>
        <Feather name="chevron-right" size={16} color={theme.color.textMuted} />
      </Pressable>
      </ScreenScaffold>
    );
  }

  const canClaim = validateLnAddressHandle(name).valid && available === true && !busy;

  return (
    <ScreenScaffold title={t('identity.title')} scroll>
      <EmptyState heading={t('identity.pick')} body={t('identity.pickBody')} />
      <View style={styles.form}>
        <AddressClaimField name={name} onChange={setName} available={available} checking={checking} />
        <PrimaryButton
          label={t('identity.claim')}
          onPress={() => {
            if (canClaim) onClaim();
          }}
          loading={busy}
        />
        {err ? <Text style={styles.err}>{err}</Text> : null}
      </View>
      <Pressable
        onPress={() => router.push('/backup')}
        style={styles.seedRow}
        accessibilityRole="button"
      >
        <Feather name="key" size={16} color={theme.color.accent} />
        <Text style={styles.seedRowText}>{t('identity.viewSeed')}</Text>
        <Feather name="chevron-right" size={16} color={theme.color.textMuted} />
      </Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  seedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    marginTop: theme.space.lg,
  },
  seedRowText: {
    flex: 1,
    fontFamily: theme.font.label.fontFamily,
    fontSize: 14,
    color: theme.color.text,
  },
  form: { gap: theme.space.xl, marginTop: theme.space.lg },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, textAlign: 'center' },
});
