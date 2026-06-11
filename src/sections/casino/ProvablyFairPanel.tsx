// Provably-fair panel — DISPLAY-ONLY (D-09 / CASINO-03): surfaces the fairness
// fields the casino exposes (server seed hash / client seed / nonce) so the player
// can verify a round externally. No in-app verification in v1.
//
// Exact field names are confirmed from satoshi-casino21 `api/game.js` at the device
// checkpoint (05-06, RESEARCH O-3); the panel renders whatever the bridge surfaces
// and falls back to an explicit empty state when nothing is available (CASINO-03
// GAP guard — the live UI doesn't currently expose PF fields).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CopyField } from '@/ui';
import { theme } from '@/ui';
import { t } from '@/i18n';
import type { ProvablyFairInfo } from './CasinoLobbyScreen';

export function ProvablyFairPanel({ info }: { info: ProvablyFairInfo | null }): React.ReactElement {
  if (!info) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('casino.fair.empty')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <CopyField label={t('casino.fair.serverSeed')} value={info.serverSeedHash} />
      <CopyField label={t('casino.fair.clientSeed')} value={info.clientSeed} />
      <CopyField label={t('casino.fair.nonce')} value={String(info.nonce)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.md },
  empty: { alignItems: 'center', paddingVertical: theme.space.xl },
  emptyText: { fontFamily: theme.font.body.fontFamily, fontSize: 14, color: theme.color.textMuted },
});
