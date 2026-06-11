// Provably-fair route — display-only panel (CASINO-03 / D-09).
import React from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, theme } from '@/ui';
import { t } from '@/i18n';
import { ProvablyFairPanel } from '@/sections/casino/ProvablyFairPanel';
import { getLastProvablyFair } from '@/sections/casino/CasinoLobbyScreen';

export default function FairScreen(): React.ReactElement {
  return (
    <ScreenScaffold title={t('casino.fair.title')} scroll>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('nfc.close')}
        style={{ marginBottom: theme.space.sm, alignSelf: 'flex-start' }}
      >
        <Feather name="chevron-left" size={26} color={theme.color.text} />
      </Pressable>
      <ProvablyFairPanel info={getLastProvablyFair()} />
    </ScreenScaffold>
  );
}
