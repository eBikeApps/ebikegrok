import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { brand } from '@/lib/brand-colors';

export function DotLoader({ delay }: { delay: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    setTimeout(() => {
      y.value = withRepeat(
        withSequence(withTiming(-8, { duration: 400 }), withTiming(0, { duration: 400 })),
        -1,
        false
      );
    }, delay);
  }, [delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: brand.primary }, style]}
    />
  );
}