import React from 'react';
import { View, Text } from 'react-native';
import { brand } from '@/lib/brand-colors';

export function WizardProgress({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  const pct = Math.round((current / total) * 100);
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>
          {label ?? `שלב ${current} מתוך ${total}`}
        </Text>
        <Text style={{ color: brand.primary, fontSize: 13, fontWeight: '700' }}>{pct}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: brand.primary,
            borderRadius: 99,
          }}
        />
      </View>
    </View>
  );
}