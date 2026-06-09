// Claimed identity card: the public name@21pay Lightning Address (+ optional npub),
// copyable. Renders ONLY public identifiers — NEVER the nsec or any private key.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { t } from '@/i18n';
import { theme } from './theme';
import { CopyField } from './CopyField';

export function LnAddressCard({
  lnAddress,
  npub,
}: {
  lnAddress: string;
  npub?: string;
}): React.ReactElement {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 350 }}
      style={styles.card}
    >
      <Text style={styles.eyebrow}>{t('identity.yourAddress')}</Text>
      <CopyField value={lnAddress} label="name@21pay" />
      {npub ? <CopyField value={npub} label="Nostr npub" /> : null}
      <Text style={styles.note}>{t('identity.share')}</Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.space.md },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted },
  note: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.xs },
});
