import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WalletProvider, rehydrate } from '@/wallet';
import { useAppFonts, theme } from '@/ui';

export default function RootLayout(): React.ReactElement {
  const fontsLoaded = useAppFonts();
  // Re-activate the persisted wallet BEFORE first paint so the balance survives a
  // restart and Home never flashes onboarding (which would risk creating a 2nd wallet).
  const [rehydrated, setRehydrated] = useState(false);
  useEffect(() => {
    rehydrate()
      .catch(() => {})
      .finally(() => setRehydrated(true));
  }, []);

  if (!fontsLoaded || !rehydrated) {
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
            <Stack.Screen name="(sections)" />
            <Stack.Screen name="nfc" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="receive" options={{ presentation: 'modal' }} />
            <Stack.Screen name="backup" options={{ presentation: 'modal' }} />
            <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="send" options={{ presentation: 'modal' }} />
          </Stack>
        </WalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
