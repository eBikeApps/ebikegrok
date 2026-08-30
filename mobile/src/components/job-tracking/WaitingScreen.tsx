import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Search, X } from 'lucide-react-native';
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
    <View style={styles.root}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        style={styles.gradient}
      >
        <View style={styles.ringsWrap}>
          <Animated.View style={[styles.ring, styles.ringOuter, ring3Style]} />
          <Animated.View style={[styles.ring, styles.ringMid, ring2Style]} />
          <Animated.View style={[styles.ring, styles.ringInner, ring1Style]} />
          <Animated.View style={iconStyle}>
            <LinearGradient
              colors={[...gradients.primaryDeep]}
              style={styles.iconOrb}
            >
              <Search size={38} color="#fff" />
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.titleBlock}>
          <Text style={styles.title}>יוצרים קשר עם הטכנאי</Text>
          <Text style={styles.subtitle}>
            עד 5 דקות לתשובה,{'\n'}בדרך כלל תוך כמה שניות
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <DotLoader key={i} delay={i * 200} />
          ))}
        </Animated.View>

        {/* Glass info card */}
        <Animated.View entering={FadeInUp.delay(700).duration(500)} style={styles.infoCard}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.infoCardAndroid]} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.infoCardWash]} />
          <View style={styles.infoCardInner}>
            <Text style={styles.infoTitle}>עד 5 דקות לתשובה</Text>
            <Text style={styles.infoSub}>בדרך כלל תוך כמה שניות</Text>
          </View>
          <View style={styles.infoCardBorder} pointerEvents="none" />
        </Animated.View>

        {/* Glass cancel — large centered tile */}
        <Animated.View
          entering={FadeInUp.delay(900).duration(400)}
          style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}
        >
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.cancelAndroid]} />
            )}
            <LinearGradient
              colors={['rgba(248,113,113,0.32)', 'rgba(239,68,68,0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'transparent']}
              style={styles.cancelSheen}
            />
            <View style={styles.cancelContent}>
              <X size={26} color="#FECACA" strokeWidth={2.6} />
              <Text style={styles.cancelText}>בטל הזמנה</Text>
            </View>
            <View style={styles.cancelBorder} pointerEvents="none" />
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringsWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: brand.primary,
  },
  ringOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  ringMid: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  ringInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  iconOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: brand.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: 36,
    paddingHorizontal: 32,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
  },
  infoCard: {
    marginTop: 48,
    marginHorizontal: 24,
    borderRadius: 22,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 390,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  infoCardAndroid: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
  },
  infoCardWash: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  infoCardInner: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  infoCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.28)',
  },
  infoTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
  },
  cancelBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 72,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cancelBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  cancelAndroid: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
  },
  cancelSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  cancelContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  cancelText: {
    color: '#FECACA',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  cancelBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
});
