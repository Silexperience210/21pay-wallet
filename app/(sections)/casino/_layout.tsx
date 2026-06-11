// Casino route group — an ISOLATED stack wrapped by the section pattern (D-07/D-08):
// SectionErrorBoundary (CASINO-04 layer 1) around SectionHost (capability injection).
// A casino crash renders the fallback here; the wallet tabs live outside this tree
// and are never unmounted.
import React from 'react';
import { Stack } from 'expo-router';
import { SectionErrorBoundary, SectionHost } from '@/sections';
import { theme } from '@/ui';
import { t } from '@/i18n';

export default function CasinoLayout(): React.ReactElement {
  return (
    <SectionErrorBoundary fallbackTitle={t('casino.unavailable')}>
      <SectionHost>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.color.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="wallet" options={{ presentation: 'modal' }} />
          <Stack.Screen name="fair" options={{ presentation: 'modal' }} />
        </Stack>
      </SectionHost>
    </SectionErrorBoundary>
  );
}
