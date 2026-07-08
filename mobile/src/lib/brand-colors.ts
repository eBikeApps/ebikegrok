/** eBike brand palette — blue for actions, green for brand/earnings */
export const brand = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryDeeper: '#1D4ED8',
  primaryLight: '#60A5FA',
  primaryMuted: '#93C5FD',
  green: '#10B981',
  greenDark: '#059669',
  greenDeeper: '#047857',
  success: '#22C55E',
  successDark: '#16A34A',
} as const;

export const gradients = {
  /** Primary CTA buttons (customer flows) */
  primary: [brand.primary, brand.primaryDark] as const,
  primaryDeep: [brand.primary, brand.primaryDeeper] as const,
  /** Brand / logo / technician earnings */
  brand: [brand.green, brand.greenDark] as const,
  brandDeep: [brand.green, brand.greenDark, brand.greenDeeper] as const,
};