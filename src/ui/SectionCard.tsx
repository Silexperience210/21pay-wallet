// Rich section-entry card for the Home "Univers" block — replaces the flat
// buttons. Tinted icon badge + title/subtitle + a soft per-section glow, with a
// staggered Moti entrance and a press-scale. Palette mirrors the 21pay web theme
// ambient orbs (orange / green / violet / pink) — one tint per section.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

export interface SectionCardProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  /** Per-section accent (hex) — drives the badge, glow and border tint. */
  tint: string;
  onPress: () => void;
  /** Entrance stagger slot (0, 1, 2…). */
  index?: number;
  /** Small mono tag rendered top-right (e.g. "signet", "live"). */
  tag?: string;
}

/** #rrggbb + alpha (0..1) → rgba() — RN has no color-mix. */
function tintAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function SectionCard({
  icon,
  title,
  subtitle,
  tint,
  onPress,
  index = 0,
  tag,
}: SectionCardProps): React.ReactElement {
  const reduced = useReducedMotion();
  return (
    <MotiView
      from={reduced ? { opacity: 1 } : { opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 450, delay: reduced ? 0 : 90 * index }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          { borderColor: tintAlpha(tint, pressed ? 0.55 : 0.22) },
          pressed && styles.cardPressed,
        ]}
      >
        {/* soft corner glow — a big translucent tinted disc bleeding off-card */}
        <View pointerEvents="none" style={[styles.glow, { backgroundColor: tintAlpha(tint, 0.07) }]} />
        <View
          style={[
            styles.badge,
            { backgroundColor: tintAlpha(tint, 0.12), borderColor: tintAlpha(tint, 0.4) },
          ]}
        >
          <Feather name={icon} size={20} color={tint} />
        </View>
        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {tag ? (
              <View style={[styles.tag, { borderColor: tintAlpha(tint, 0.4) }]}>
                <Text style={[styles.tagText, { color: tint }]}>{tag}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={theme.color.textMuted} />
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.lg,
    backgroundColor: 'rgba(255,255,255,0.025)',
    overflow: 'hidden',
  },
  cardPressed: { transform: [{ scale: 0.985 }] },
  glow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -95,
    right: -55,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  title: { fontFamily: theme.font.label.fontFamily, fontSize: 15, color: theme.color.text },
  tag: {
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  tagText: { fontFamily: theme.font.mono.fontFamily, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  subtitle: { fontFamily: theme.font.body.fontFamily, fontSize: 12, lineHeight: 16, color: theme.color.textMuted },
});
