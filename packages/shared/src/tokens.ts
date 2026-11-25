/**
 * ADEY design tokens — single source of truth for the mobile app and website.
 * Brand: Gold #E8B923 · Forest Green #174B3A · Ivory #FAF8F2 · Charcoal #202522 · White #FFFFFF
 */

export const brand = {
  gold: '#E8B923',
  forest: '#174B3A',
  ivory: '#FAF8F2',
  charcoal: '#202522',
  white: '#FFFFFF',
} as const;

export const palette = {
  gold: { 50: '#FDF8E6', 100: '#FBEFC2', 200: '#F6E08A', 300: '#F0CF56', 400: '#E8B923', 500: '#D4A61A', 600: '#B38A12', 700: '#8F6D0E', 800: '#6B510B', 900: '#4A3807' },
  forest: { 50: '#E8F1EE', 100: '#CDE0D9', 200: '#9FC3B7', 300: '#6FA393', 400: '#3F7F6B', 500: '#174B3A', 600: '#133F31', 700: '#0F3227', 800: '#0B251D', 900: '#071813' },
  neutral: { 0: '#FFFFFF', 50: '#FAF8F2', 100: '#F2EFE6', 200: '#E4E0D4', 300: '#CFCAB9', 400: '#A8A396', 500: '#7E7A6F', 600: '#5C594F', 700: '#3F3D36', 800: '#2C2A25', 900: '#202522', 950: '#15181A' },
  success: { light: '#2E7D4F', dark: '#5BCB8A' },
  warning: { light: '#B26A00', dark: '#F5B041' },
  danger: { light: '#B3261E', dark: '#F28B82' },
  info: { light: '#1F5F8B', dark: '#7FB8E6' },
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  overlay: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  skeleton: string;
};

export const lightTheme: ThemeColors = {
  background: palette.neutral[50],
  surface: palette.neutral[0],
  surfaceElevated: palette.neutral[0],
  surfaceMuted: palette.neutral[100],
  border: palette.neutral[200],
  borderStrong: palette.neutral[300],
  text: palette.neutral[900],
  textMuted: palette.neutral[500],
  textInverse: palette.neutral[0],
  primary: palette.forest[500],
  onPrimary: palette.neutral[0],
  primarySoft: palette.forest[50],
  accent: palette.gold[400],
  onAccent: palette.neutral[900],
  accentSoft: palette.gold[50],
  success: palette.success.light,
  warning: palette.warning.light,
  danger: palette.danger.light,
  info: palette.info.light,
  overlay: 'rgba(32,37,34,0.55)',
  tabBar: palette.neutral[0],
  tabActive: palette.forest[500],
  tabInactive: palette.neutral[400],
  skeleton: palette.neutral[200],
};

export const darkTheme: ThemeColors = {
  background: palette.neutral[950],
  surface: palette.neutral[900],
  surfaceElevated: palette.neutral[800],
  surfaceMuted: palette.neutral[800],
  border: palette.neutral[700],
  borderStrong: palette.neutral[600],
  text: palette.neutral[50],
  textMuted: palette.neutral[400],
  textInverse: palette.neutral[900],
  primary: palette.forest[300],
  onPrimary: palette.neutral[950],
  primarySoft: palette.forest[800],
  accent: palette.gold[400],
  onAccent: palette.neutral[900],
  accentSoft: palette.gold[900],
  success: palette.success.dark,
  warning: palette.warning.dark,
  danger: palette.danger.dark,
  info: palette.info.dark,
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: palette.neutral[900],
  tabActive: palette.gold[400],
  tabInactive: palette.neutral[500],
  skeleton: palette.neutral[700],
};

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64 } as const;
export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const typography = {
  // Font families are resolved per platform; Ethiopic needs Noto Sans Ethiopic for Amharic text.
  families: { sans: 'Inter', display: 'Inter', ethiopic: 'NotoSansEthiopic' },
  sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 34, '4xl': 42 },
  lineHeights: { xs: 16, sm: 20, md: 24, lg: 26, xl: 30, '2xl': 36, '3xl': 42, '4xl': 50 },
  weights: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export const shadows = {
  sm: { shadowColor: '#202522', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: '#202522', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
} as const;

export const brandText = {
  name: 'ADEY CONNECT',
  nameAm: 'አደይ',
  tagline: 'Connecting Communities. Growing Businesses.',
} as const;
