import React, { useEffect } from 'react';
import { View, Text, Dimensions, StyleSheet, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { EBikeLogo } from '@/components/auth/AuthUi';

const { width, height } = Dimensions.get('window');
const BAR_WIDTH = Math.min(width * 0.42, 180);

/**
 * App bootstrap loading — matches sign-in: cinematic bg + brand logo + soft motion.
 * Shown while RTL/session resolve after native splash hides.
 */
export function LoadingScreen() {
  const fadeIn = useSharedValue(0);
  const bgScale = useSharedValue(1);
  const barProgress = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const brandOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0.35);

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });

    // Slow cinematic zoom on background (Ken Burns)
    bgScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 9000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    brandOpacity.value = withDelay(280, withTiming(1, { duration: 700 }));
    taglineOpacity.value = withDelay(520, withTiming(1, { duration: 700 }));

    // Indeterminate progress bar
    barProgress.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 0 })
        ),
        -1
      )
    );

    glowPulse.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1600, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
  }, []);

  const rootFade = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgScale.value }],
  }));

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: interpolate(brandOpacity.value, [0, 1], [10, 0]) }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: interpolate(taglineOpacity.value, [0, 1], [8, 0]) }],
  }));

  const barTrackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fadeIn.value, [0, 1], [0, 1]),
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: interpolate(barProgress.value, [0, 1], [BAR_WIDTH * 0.12, BAR_WIDTH]),
    opacity: interpolate(barProgress.value, [0, 0.15, 0.85, 1], [0.4, 1, 1, 0.35]),
  }));

  const bottomGlowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value,
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background photo — same as sign-in */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <ImageBackground
          source={require('@/assets/images/sign-in-bg.jpg')}
          style={styles.bg}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Depth overlays — match sign-in gradient language */}
      <LinearGradient
        colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.68)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(5,46,22,0.35)', 'transparent', 'rgba(6,20,40,0.55)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft emerald bloom behind logo */}
      <Animated.View style={[styles.logoBloom, bottomGlowStyle]} pointerEvents="none" />

      <Animated.View style={[styles.content, rootFade]}>
        <View style={styles.logoWrap}>
          <EBikeLogo />
        </View>

        <Animated.View style={[{ alignItems: 'center', marginTop: 20 }, brandStyle]}>
          <Text style={styles.brand}>eBike</Text>
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center', marginTop: 10 }, taglineStyle]}>
          <Text style={styles.tagline}>שירות תיקון אופניים חשמליים</Text>
          <View style={styles.taglineRule} />
        </Animated.View>

        {/* Progress */}
        <Animated.View style={[styles.barTrack, barTrackStyle]}>
          <Animated.View style={[styles.barFill, barFillStyle]}>
            <LinearGradient
              colors={['rgba(16,185,129,0.2)', '#34d399', '#6ee7b7', 'rgba(16,185,129,0.2)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>

        <Animated.Text style={[styles.loadingLabel, taglineStyle]}>טוען…</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#052e16',
  },
  bg: {
    width,
    height,
  },
  logoBloom: {
    position: 'absolute',
    alignSelf: 'center',
    top: height * 0.22,
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(16,185,129,0.18)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 60,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  logoWrap: {
    // Slightly tighter than full sign-in logo for loading composition
    transform: [{ scale: 0.88 }],
  },
  brand: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 6,
    textTransform: 'uppercase',
  },
  tagline: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  taglineRule: {
    marginTop: 14,
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(52,211,153,0.55)',
  },
  barTrack: {
    position: 'absolute',
    bottom: 72,
    width: BAR_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingLabel: {
    position: 'absolute',
    bottom: 48,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.2,
  },
});
