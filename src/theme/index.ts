export const Colors = {
  primary: '#1a4a2e',
  primaryLight: '#2d6a42',
  primaryDark: '#0d2a1a',
  gold: '#c9a84c',
  goldLight: '#e8c96a',
  goldDark: '#a07828',

  dark: {
    background: '#0d1f15',
    surface: '#1a3a2a',
    surfaceRaised: '#224433',
    border: '#2d5a3d',
    text: '#f0ebe0',
    textSecondary: '#9ab8a4',
    textMuted: '#5a7a65',
    tabBar: '#0d2218',
  },
  light: {
    background: '#f5f5f0',
    surface: '#ffffff',
    surfaceRaised: '#f0f4ee',
    border: '#d8e8d0',
    text: '#1a2e1e',
    textSecondary: '#4a6a52',
    textMuted: '#8aaa92',
    tabBar: '#ffffff',
  },
};

export const Typography = {
  arabicLarge: {
    fontSize: 28,
    lineHeight: 52,
    fontFamily: 'NotoNaskhArabic_400Regular' as const,
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  },
  arabicMedium: {
    fontSize: 22,
    lineHeight: 42,
    fontFamily: 'NotoNaskhArabic_400Regular' as const,
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  },
  arabicSmall: {
    fontSize: 18,
    lineHeight: 36,
    fontFamily: 'NotoNaskhArabic_400Regular' as const,
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  },
  heading: { fontSize: 22, fontWeight: '700' as const },
  subheading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};
