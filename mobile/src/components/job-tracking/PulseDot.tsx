import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { brand } from '@/lib/brand-colors';

export function PulseDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.4, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 800 }), withTiming(0.6, { duration: 800 })),
      -1,
      false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: brand.success,
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: brand.successDark,
        }}
      />
    </View>
  );
}