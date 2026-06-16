import React, { useEffect } from 'react';
import { View, Dimensions } from 'react-native';
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

const { width } = Dimensions.get('window');
const LOGO_SIZE = 110;
const RING_SIZE = 148;

export function LoadingScreen() {
  const fadeIn = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.55);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.4);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    // Fade in everything
    fadeIn.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) });

    // Gentle logo breathe
    logoScale.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    // Ripple ring 1
    ring1Scale.value = withRepeat(
      withSequence(
        withTiming(1.75, { duration: 1900, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 0 })
      ),
      -1
    );
    ring1Opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1900, easing: Easing.out(Easing.cubic) }),
        withTiming(0.55, { duration: 0 })
      ),
      -1
    );

    // Ripple ring 2 — offset
    ring2Scale.value = withDelay(
      950,
      withRepeat(
        withSequence(
          withTiming(1.75, { duration: 1900, easing: Easing.out(Easing.quad) }),
          withTiming(1.0, { duration: 0 })
        ),
        -1
      )
    );
    ring2Opacity.value = withDelay(
      950,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 1900, easing: Easing.out(Easing.cubic) }),
          withTiming(0.4, { duration: 0 })
        ),
        -1
      )
    );

    // Bouncing dots — wave pattern
    const dotAnim = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 380, easing: Easing.out(Easing.back(1.8)) }),
            withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }),
            withDelay(380, withTiming(0, { duration: 0 }))
          ),
          -1
        )
      );

    dot1.value = dotAnim(0);
    dot2.value = dotAnim(170);
    dot3.value = dotAnim(340);
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const logoContainerStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: interpolate(fadeIn.value, [0, 1], [12, 0]) }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
    transform: [{ scale: ring1Scale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }));

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(dot1.value, [0, 1], [0, -10]) }],
    opacity: interpolate(dot1.value, [0, 0.4, 1], [0.25, 1, 0.25]),
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(dot2.value, [0, 1], [0, -10]) }],
    opacity: interpolate(dot2.value, [0, 0.4, 1], [0.25, 1, 0.25]),
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(dot3.value, [0, 1], [0, -10]) }],
    opacity: interpolate(dot3.value, [0, 0.4, 1], [0.25, 1, 0.25]),
  }));

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#052e16',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Soft radial glow behind logo — shifted up to align with rings */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: width * 0.85,
            height: width * 0.85,
            borderRadius: (width * 0.85) / 2,
            backgroundColor: '#064e3b',
            transform: [{ translateY: -88 }],
          },
          fadeStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: width * 0.45,
            height: width * 0.45,
            borderRadius: (width * 0.45) / 2,
            backgroundColor: '#065f46',
            opacity: 0.7,
            transform: [{ translateY: -88 }],
          },
          fadeStyle,
        ]}
      />

      {/* Logo + ripple rings */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* Ring 1 */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderWidth: 1.5,
              borderColor: '#34d399',
            },
            ring1Style,
          ]}
        />
        {/* Ring 2 */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderWidth: 1,
              borderColor: '#6ee7b7',
            },
            ring2Style,
          ]}
        />

        {/* Logo circle */}
        <Animated.View
          style={[
            {
              width: LOGO_SIZE,
              height: LOGO_SIZE,
              borderRadius: LOGO_SIZE / 2,
              backgroundColor: 'rgba(52, 211, 153, 0.1)',
              borderWidth: 1.5,
              borderColor: 'rgba(52, 211, 153, 0.35)',
            },
            logoContainerStyle,
          ]}
        />
      </View>

      {/* Bouncing dots */}
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            gap: 9,
            marginTop: 40,
            alignItems: 'flex-end',
            height: 20,
          },
          fadeStyle,
        ]}
      >
        <Animated.View
          style={[
            { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#34d399' },
            dot1Style,
          ]}
        />
        <Animated.View
          style={[
            { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#34d399' },
            dot2Style,
          ]}
        />
        <Animated.View
          style={[
            { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#34d399' },
            dot3Style,
          ]}
        />
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View style={[{ alignItems: 'center', marginTop: 28 }, textStyle]}>
        <Animated.Text
          style={{
            color: '#ffffff',
            fontSize: 34,
            fontWeight: '700',
            letterSpacing: 2,
          }}
        >
          eBike
        </Animated.Text>
        <Animated.Text
          style={{
            color: 'rgba(110, 231, 183, 0.75)',
            fontSize: 13,
            marginTop: 6,
            letterSpacing: 0.4,
          }}
        >
          שירות תיקון אופניים חשמליים
        </Animated.Text>
      </Animated.View>
    </View>
  );
}
