// Custom bottom tab bar (UX-02): Wallet / Activity / Identity, always under the
// pinned CustodyBadge (rendered by each screen's ScreenScaffold).
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from './theme';

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'zap',
  activity: 'list',
  identity: 'user',
};
const LABELS: Record<string, string> = {
  index: 'Wallet',
  activity: 'Activity',
  identity: 'Identity',
};

export function BottomNav({ state, navigation }: BottomTabBarProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const color = focused ? theme.color.accent : theme.color.textMuted;
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              if (!focused) navigation.navigate(route.name);
            }}
            style={styles.tab}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={LABELS[route.name] ?? route.name}
          >
            <Feather name={ICONS[route.name] ?? 'circle'} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{LABELS[route.name] ?? route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 44 },
  label: { fontFamily: theme.font.label.fontFamily, fontSize: 11 },
});
