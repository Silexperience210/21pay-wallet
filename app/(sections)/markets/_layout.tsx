// Markets route group — ISOLATED stack wrapped by the section pattern (MARKET-07):
// SectionErrorBoundary (layer 1) around SectionHost (capability injection). A
// Markets crash renders the fallback here; the wallet tabs live outside this tree.
import React from 'react';
import { Stack } from 'expo-router';
import { SectionErrorBoundary, SectionHost } from '@/sections';
import { theme } from '@/ui';
import { t } from '@/i18n';

export default function MarketsLayout(): React.ReactElement {
  return (
    <SectionErrorBoundary fallbackTitle={t('markets.unavailable')}>
      <SectionHost>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.color.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="market" />
          <Stack.Screen name="bet" options={{ presentation: 'modal' }} />
          <Stack.Screen name="create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="positions" />
        </Stack>
      </SectionHost>
    </SectionErrorBoundary>
  );
}
