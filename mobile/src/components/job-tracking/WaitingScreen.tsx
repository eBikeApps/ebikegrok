import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Search, Clock, X } from 'lucide-react-native';
import { brand, gradients } from '@/lib/brand-colors';
import { DotLoader } from './DotLoader';

export function WaitingScreen({ onCancel }: { onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const animate = async () => {
      ring1.value = withRepeat(
        withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 0 })),
        -1,
        false
      );
      await delay(600);
      ring2.value = withRepeat(
        withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 0 })),
        -1,
        false
      );
      await delay(600);
      ring3.value = withRepeat(
        withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 0 })),
        -1,
        false
      );
    };
    animate();
    iconScale.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true
    );
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.3, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.6, 1.8]) }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.3, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.6, 1.8]) }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring3.value, [0, 0.3, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(ring3.value, [0, 1], [0.6, 1.8]) }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={[
              { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: brand.primary },
              ring3Style,
            ]}
          />
          <Animated.View
            style={[
              { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: brand.primary },
              ring2Style,
            ]}
          />
          <Animated.View
            style={[
              { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: brand.primary },
              ring1Style,
            ]}
          />
          <Animated.View style={iconStyle}>
            <LinearGradient
              colors={[...gradients.primaryDeep]}
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: brand.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
              }}
            >
              <Search size={38} color="#fff" />
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ alignItems: 'center', marginTop: 36, paddingHorizontal: 32 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
            מחפשים טכנאי...
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
            ממתינים לאישור טכנאי שיגיע אליך בהקדם
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={{ flexDirection: 'row', gap: 8, marginTop: 32 }}>
          {[0, 1, 2].map((i) => (
            <DotLoader key={i} delay={i * 200} />
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(700).duration(500)}
          style={{
            marginTop: 48,
            marginHorizontal: 24,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>זמן ממוצע לאישור</Text>
              <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>בדרך כלל עד 2-3 דקות</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(900).duration(400)}
          style={{ marginTop: 'auto', paddingBottom: insets.bottom + 24, paddingHorizontal: 24, width: '100%' }}
        >
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.25)',
            })}
          >
            <X size={18} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600' }}>בטל הזמנה</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}