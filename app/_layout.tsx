import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WalletProvider } from '@/wallet';
import { useAppFonts, theme } from '@/ui';

export default function RootLayout(): React.ReactElement {
  const fontsLoaded = useAppFonts();
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: theme.color.bg }} />;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <WalletProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.color.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="nfc" options={{ presentation: 'fullScreenModal' }} />
            {/* receive / send / scan modal routes are added in plans 03-05 / 03-06 */}
          </Stack>
        </WalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
