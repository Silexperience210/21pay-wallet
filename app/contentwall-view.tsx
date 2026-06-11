// ContentWall viewer — renders a SIGNED content URL in a hardened WebView pinned
// to the 21pay LNbits origin (same hardening posture as the casino host). The
// signed URL carries the access token; nothing else of value lives here.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { theme } from '@/ui';

const ORIGIN = process.env.EXPO_PUBLIC_LNBITS_URL ?? 'https://21pay.org';

export default function ContentwallView(): React.ReactElement {
  const params = useLocalSearchParams<{ url: string; title?: string }>();
  const url = String(params.url ?? '');
  const allowed = url.startsWith(`${ORIGIN}/contentwall/`);

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Feather name="x" size={22} color={theme.color.text} />
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          {String(params.title ?? '')}
        </Text>
      </View>
      {allowed ? (
        <WebView
          source={{ uri: url }}
          originWhitelist={[`${ORIGIN}/*`]}
          onShouldStartLoadWithRequest={(req) => req.url.startsWith(ORIGIN)}
          setSupportMultipleWindows={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          style={styles.web}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.err}>Invalid content URL.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingTop: 56,
    paddingHorizontal: theme.space.xl,
    paddingBottom: theme.space.md,
  },
  barTitle: { flex: 1, fontFamily: theme.font.label.fontFamily, fontSize: 15, color: theme.color.text },
  web: { flex: 1, backgroundColor: theme.color.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 14, color: theme.color.destructive },
});
