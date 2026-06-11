// Mineurs route group — ISOLATED stack wrapped by the section pattern (MINE-05):
// SectionErrorBoundary (layer 1) around SectionHost (capability injection). A
// Mineurs crash renders the fallback here; the wallet tabs live outside this tree.
import React from 'react';
import { Stack } from 'expo-router';
import { SectionErrorBoundary, SectionHost } from '@/sections';
import { theme } from '@/ui';
import { t } from '@/i18n';

export default function MinersLayout(): React.ReactElement {
  return (
    <SectionErrorBoundary fallbackTitle={t('miners.unavailable')}>
      <SectionHost>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.color.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="rent" options={{ presentation: 'modal' }} />
          <Stack.Screen name="dashboard" />
        </Stack>
      </SectionHost>
    </SectionErrorBoundary>
  );
}
