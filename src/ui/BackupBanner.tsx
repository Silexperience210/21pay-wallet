// Persistent warning banner urging the user to back up their recovery phrase, shown
// until they confirm. Confirmation is a non-secret flag in prefs (NOT a key). The
// real backup quiz lands in the Phase-1 security checkpoint; until then "I've written
// it down" sets the flag so the banner stops nagging. Hidden once confirmed.
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { getPref } from '@/core/state';
import { t } from '@/i18n';
import { theme } from './theme';

const FLAG = 'backupConfirmed';

export function BackupBanner(): React.ReactElement | null {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        setConfirmed(getPref(FLAG) === '1');
      } catch {
        setConfirmed(true); // never block the UI on a prefs read error
      }
    }, []),
  );

  if (confirmed !== false) return null;

  // The flag is now set by the verification quiz in /backup (SEC-05), not here.
  const confirm = () => {
    router.push('/backup');
  };

  return (
    <View style={styles.wrap}>
      <Feather name="alert-triangle" size={18} color={theme.color.accent} />
      <View style={styles.textCol}>
        <Text style={styles.title}>{t('backup.warn')}</Text>
        <Text style={styles.body}>{t('backup.body')}</Text>
      </View>
      <Pressable onPress={confirm} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('backup.cta')}>
        <Text style={styles.cta}>{t('backup.cta')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    backgroundColor: 'rgba(247,147,26,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(247,147,26,0.35)',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    marginBottom: theme.space.lg,
  },
  textCol: { flex: 1 },
  title: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.text },
  body: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, marginTop: 2 },
  cta: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.accent },
});
