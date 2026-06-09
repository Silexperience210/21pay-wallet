// 21pay design tokens (single source). Ink black + cream + rationed Bitcoin orange.
export const theme = {
  color: {
    bg: '#050505',
    surface: '#0E0E0E',
    cardFill: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
    text: '#fafafa',
    textMuted: 'rgba(250,250,250,0.55)',
    accent: '#F7931A',
    destructive: '#ff5e74',
    success: '#3ECF8E',
    orbOrange: '#F7931A',
    orbPink: '#ff5e74',
    orbViolet: '#7850ff',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 40, '3xl': 64 },
  radius: { sm: 10, md: 16, lg: 24, pill: 999 },
  font: {
    display: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, lineHeight: 34 },
    heading: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, lineHeight: 26 },
    body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, lineHeight: 22 },
    label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, lineHeight: 16 },
    monoBalance: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 40, lineHeight: 46 },
    mono: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 15, lineHeight: 20 },
  },
} as const;
