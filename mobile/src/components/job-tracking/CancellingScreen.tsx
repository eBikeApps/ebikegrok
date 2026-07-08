import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

export function CancellingScreen() {
  const bikeX = useSharedValue(-60);
  const bikeY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const sparkle1 = useSharedValue(0);
  const sparkle2 = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    bikeX.value = withRepeat(
      withSequence(withTiming(420, { duration: 2200 }), withTiming(-60, { duration: 0 })),
      -1,
      false
    );
    bikeY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 400 }),
        withTiming(6, { duration: 400 }),
        withTiming(-6, { duration: 400 }),
        withTiming(0, { duration: 400 })
      ),
      -1,
      false
    );
    setTimeout(() => {
      textOpacity.value = withTiming(1, { duration: 600 });
    }, 400);
    sparkle1.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1,
      false
    );
    setTimeout(() => {
      sparkle2.value = withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
        -1,
        false
      );
    }, 350);
  }, []);

  const bikeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bikeX.value }, { translateY: bikeY.value }],
  }));
  const sp1Style = useAnimatedStyle(() => ({
    opacity: sparkle1.value,
    transform: [{ scale: 0.8 + sparkle1.value * 0.4 }],
  }));
  const sp2Style = useAnimatedStyle(() => ({
    opacity: sparkle2.value,
    transform: [{ scale: 0.8 + sparkle2.value * 0.4 }],
  }));
  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: interpolate(textOpacity.value, [0, 1], [20, 0]) }],
  }));

  return (
    <Animated.View
      style={[{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }, containerStyle]}
    >
      <LinearGradient
        colors={['#0F172A', '#1a2744', '#0F172A']}
        style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.Text style={[{ position: 'absolute', top: '30%', left: '20%', fontSize: 28 }, sp1Style]}>✨</Animated.Text>
        <Animated.Text style={[{ position: 'absolute', top: '28%', right: '22%', fontSize: 22 }, sp2Style]}>⭐</Animated.Text>
        <Animated.Text style={[{ position: 'absolute', top: '38%', left: '35%', fontSize: 18 }, sp1Style]}>✨</Animated.Text>
        <Animated.Text style={[{ position: 'absolute', bottom: '32%', right: '18%', fontSize: 24 }, sp2Style]}>✨</Animated.Text>

        <View style={{ width: '90%', height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {[...Array(8)].map((_, i) => (
              <View key={i} style={{ width: 24, height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
            ))}
          </View>
        </View>

        <View style={{ width: '90%', height: 70, overflow: 'hidden', justifyContent: 'center' }}>
          <Animated.Text style={[{ fontSize: 48, position: 'absolute' }, bikeStyle]}>🚲</Animated.Text>
        </View>

        <View style={{ width: '90%', height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 20, marginBottom: 52 }} />

        <Animated.View style={[{ alignItems: 'center', paddingHorizontal: 32 }, textStyle]}>
          <Text style={{ color: '#F8FAFC', fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
            נתראה בקרוב! 🛴🚲
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
            ההזמנה בוטלה בהצלחה
          </Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}