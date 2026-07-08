import { brand } from './brand-colors';

export type AppColorScheme = 'light' | 'dark';

export const themeColors = {
  light: {
    background: '#F9FAFB',
    card: '#FFFFFF',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E5E7EB',
    primary: brand.primary,
    brand: brand.green,
    statusBar: 'dark' as const,
  },
  dark: {
    background: '#0F172A',
    card: '#1E293B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    tabBar: '#1E293B',
    tabBarBorder: '#334155',
    primary: brand.primaryLight,
    brand: brand.green,
    statusBar: 'light' as const,
  },
};

export function getThemeColors(scheme: AppColorScheme) {
  return themeColors[scheme];
}