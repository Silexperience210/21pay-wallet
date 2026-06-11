// Per-section render isolation (CASINO-04 / D-08) — LAYER 1 of the three-layer
// defense: this class boundary catches RENDER/LIFECYCLE errors only. Layer 2
// (WebView native crash via onRenderProcessGone) and layer 3 (try/catch around
// async bridge/wallet calls) are implemented in the section screens (05-05);
// all three are exercised at the device checkpoint (05-06).
//
// The fallback deliberately uses ONLY plain RN primitives + theme tokens — no
// Skia/Moti/Reanimated — so it still renders even when the crash implicates the
// animation stack (and stays unit-testable without native mocks).
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../ui/theme';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo): void {
    // Log only the message + a truncated component stack — NEVER key material,
    // mnemonic, or section secret state (T-05-05).
    console.warn(
      `[section] render error: ${err.message}`,
      (info.componentStack ?? '').slice(0, 300),
    );
  }

  private retry = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{this.props.fallbackTitle ?? 'Section indisponible'}</Text>
        <Text style={styles.body}>Le portefeuille n'est pas affecté.</Text>
        <Pressable onPress={this.retry} accessibilityRole="button" style={styles.retry}>
          <Text style={styles.retryLabel}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    padding: theme.space.xl,
    backgroundColor: theme.color.bg,
  },
  title: { fontFamily: theme.font.heading.fontFamily, fontSize: 20, color: theme.color.text },
  body: { fontFamily: theme.font.body.fontFamily, fontSize: 14, color: theme.color.textMuted },
  retry: {
    marginTop: theme.space.md,
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
  },
  retryLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 15, color: theme.color.bg },
});
