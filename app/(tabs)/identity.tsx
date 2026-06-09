import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ScreenScaffold, theme } from '@/ui';

// Placeholder — the name@21pay claim + npub card land in plan 03-07.
export default function Identity(): React.ReactElement {
  return (
    <ScreenScaffold title="Identity">
      <Text style={styles.t}>
        Claim your name@21pay Lightning Address and view your Nostr identity — coming in the next
        build.
      </Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  t: { fontFamily: theme.font.body.fontFamily, fontSize: 15, lineHeight: 22, color: theme.color.textMuted },
});
