import React, { useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

export function EBikeLogo() {
  const scaleValue = useSharedValue(0.5);
  const opacityValue = useSharedValue(0);
  const floatValue = useSharedValue(0);
  const glowIntensity = useSharedValue(0.2);
  const rotateValue = useSharedValue(-4);

  const LOGO_WIDTH = width * 0.64 * 1.5 * 1.3 * 0.92;
  const LOGO_HEIGHT = LOGO_WIDTH * 0.75;

  useEffect(() => {
    scaleValue.value = withDelay(200, withSpring(1, { damping: 11, stiffness: 75 }));
    opacityValue.value = withDelay(200, withTiming(1, { duration: 700 }));
    rotateValue.value = withDelay(200, withSpring(0, { damping: 13, stiffness: 65 }));
    floatValue.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-7, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
          withTiming(7, { duration: 2800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    glowIntensity.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.15, { duration: 1800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scaleValue.value },
      { translateY: floatValue.value },
      { rotate: `${rotateValue.value}deg` },
    ],
    opacity: opacityValue.value,
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowIntensity.value, [0, 1], [0.1, 0.45]),
    transform: [{ scale: interpolate(glowIntensity.value, [0, 1], [0.92, 1.08]) }],
  }));

  const borderGlowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      glowIntensity.value,
      [0, 1],
      ["rgba(16,185,129,0.25)", "rgba(16,185,129,0.95)"]
    ),
    shadowOpacity: interpolate(glowIntensity.value, [0, 1], [0.3, 0.85]),
  }));

  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View style={[wrapperStyle, { alignItems: "center" }]}>
        <Animated.View
          style={[
            outerGlowStyle,
            {
              position: "absolute",
              width: LOGO_WIDTH + 6,
              height: LOGO_HEIGHT + 4,
              borderRadius: 8,
              backgroundColor: "#10b981",
              shadowColor: "#10b981",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 45,
            },
          ]}
        />
        <Animated.View
          style={[
            borderGlowStyle,
            {
              backgroundColor: "transparent",
              borderRadius: 8,
              borderWidth: 1.5,
              shadowColor: "#10b981",
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 22,
              overflow: "hidden",
            },
          ]}
        >
          <Image
            source={require("@/assets/images/ebike-logo-transparent.png")}
            style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
            contentFit="contain"
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export function GoogleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export function AppleIconWhite() {
  return <FontAwesome name="apple" size={24} color="#ffffff" />;
}

export function SocialButton3D({
  onPress,
  loading,
  disabled,
  label,
  icon,
  variant,
}: {
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
  variant: "google" | "apple";
}) {
  const pressed = useSharedValue(0);
  const isGoogle = variant === "google";

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(pressed.value, [0, 1], [0, 5]) }],
    shadowOpacity: interpolate(pressed.value, [0, 1], [0.32, 0.08]),
  }));

  const depthStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0.0]),
  }));

  return (
    <View style={{ marginBottom: 16, height: 75 }}>
      <Animated.View
        style={[
          depthStyle,
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 70,
            borderRadius: 22,
            backgroundColor: isGoogle ? "#9ea3a8" : "#1a1a1a",
          },
        ]}
      />
      <Animated.View
        style={[
          surfaceStyle,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 70,
            borderRadius: 22,
            overflow: "hidden",
            backgroundColor: isGoogle ? "#ffffff" : "#000000",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 20,
            elevation: 12,
          },
        ]}
      >
        <Pressable
          onPress={onPress}
          disabled={disabled}
          onPressIn={() => {
            pressed.value = withSpring(1, { damping: 18, stiffness: 350 });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onPressOut={() => {
            pressed.value = withSpring(0, { damping: 18, stiffness: 350 });
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            opacity: disabled && !loading ? 0.6 : 1,
          }}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0.0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 35,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
            }}
          />
          {loading ? (
            <ActivityIndicator size="small" color={isGoogle ? "#4285F4" : "#ffffff"} />
          ) : (
            icon
          )}
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: isGoogle ? "#1f2937" : "#ffffff",
              letterSpacing: 0.3,
            }}
          >
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}