import React from 'react';
import { View, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';

export const PHONE_COLUMN_WIDTH = 390;

export function useIsTablet() {
  const { width, height } = useWindowDimensions();
  return Math.min(width, height) >= 600;
}

export function phoneColumnStyle(isTablet: boolean) {
  return {
    width: '100%' as const,
    maxWidth: isTablet ? PHONE_COLUMN_WIDTH : undefined,
    alignSelf: 'center' as const,
  };
}

/** Full-bleed grey canvas; inner column is iPhone-width on tablet. */
export function PhoneColumn({
  children,
  backgroundColor = '#F9FAFB',
  style,
}: {
  children: React.ReactNode;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const isTablet = useIsTablet();
  return (
    <View style={[{ flex: 1, width: '100%', backgroundColor }, style]}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: isTablet ? PHONE_COLUMN_WIDTH : undefined,
          alignSelf: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default PhoneColumn;
