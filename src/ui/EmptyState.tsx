import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { theme } from './theme';

export function EmptyState({
  heading,
  body,
}: {
  heading: string;
  body: string;
}): React.ReactElement {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.wrap}
    >
      <Text style={styles.h}>{heading}</Text>
      <Text style={styles.b}>{body}</Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: theme.space['2xl'] },
  h: {
    fontFamily: theme.font.heading.fontFamily,
    fontSize: 18,
    color: theme.color.text,
    marginBottom: theme.space.sm,
  },
  b: {
    fontFamily: theme.font.body.fontFamily,
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
});
