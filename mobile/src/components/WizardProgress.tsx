import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export function WizardProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const pct = Math.min(100, Math.max(0, Math.round((current / total) * 100)));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct / 100, {
      duration: 480,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(progress.value * 100, 4)}%`,
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
        )}
        <View style={[StyleSheet.absoluteFill, styles.blueWash]} />

        <View style={styles.inner}>
          {/* Glass track */}
          <View style={styles.track}>
            <View style={styles.trackInner} />
            <Animated.View style={[styles.fill, fillStyle]}>
              <LinearGradient
                colors={['#93C5FD', '#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Shine on fill */}
              <LinearGradient
                colors={['rgba(255,255,255,0.55)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.fillShine}
              />
            </Animated.View>
          </View>

          {/* Step dots */}
          <View style={styles.dots}>
            {Array.from({ length: total }, (_, i) => {
              const step = i + 1;
              const done = step < current;
              const active = step === current;
              return (
                <View
                  key={step}
                  style={[
                    styles.dot,
                    done && styles.dotDone,
                    active && styles.dotActive,
                  ]}
                >
                  {done ? (
                    <View style={styles.dotCheck} />
                  ) : (
                    <Text
                      style={[
                        styles.dotNum,
                        active && styles.dotNumActive,
                      ]}
                    >
                      {step}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.border} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  androidGlass: {
    backgroundColor: 'rgba(239,246,255,0.82)',
  },
  blueWash: {
    backgroundColor: 'rgba(191,219,254,0.32)',
  },
  inner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  track: {
    height: 12,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.4)',
    justifyContent: 'center',
  },
  trackInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    overflow: 'hidden',
    minWidth: 12,
  },
  fillShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  dotDone: {
    backgroundColor: 'rgba(37,99,235,0.9)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: '#3B82F6',
    borderWidth: 2,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  dotCheck: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  dotNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  dotNumActive: {
    color: '#1D4ED8',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
});
