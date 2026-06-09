import React from 'react';
import { Tabs } from 'expo-router';
import { BottomNav } from '@/ui';

export default function TabsLayout(): React.ReactElement {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomNav {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="identity" />
    </Tabs>
  );
}
