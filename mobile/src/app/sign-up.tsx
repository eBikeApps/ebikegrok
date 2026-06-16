import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import ConfirmModal from "@/components/ConfirmModal";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { authClient } from "@/lib/auth/auth-client";
import { useInvalidateSession } from "@/lib/auth/use-session";
import * as Linking from "expo-linking";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native";
import Svg, { Path, Circle, Ellipse, G } from "react-native-svg";
import { playSystemSound } from "@/lib/system-sounds";

function EBikeLogoSmall() {
  return (
    <Svg width={100} height={70} viewBox="0 0 180 120">
      <Circle cx="35" cy="75" r="22" stroke="#10b981" strokeWidth="4" fill="none" />
      <Circle cx="35" cy="75" r="4" fill="#10b981" />
      <Circle cx="145" cy="75" r="22" stroke="#10b981" strokeWidth="4" fill="none" />
      <Circle cx="145" cy="75" r="4" fill="#10b981" />
      <Path d="M35,75 L70,45 L110,45 L145,75 M70,45 L70,75 M70,75 L110,45 M110,45 L110,30" stroke="#059669" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Ellipse cx="70" cy="28" rx="12" ry="5" fill="#047857" />
      <Path d="M70,33 L70,45" stroke="#059669" strokeWidth="4" />
      <Path d="M105,25 L115,25 M110,20 L110,30" stroke="#059669" strokeWidth="4" strokeLinecap="round" />
      <Circle cx="70" cy="75" r="10" fill="#10b981" />
      <Path d="M67,72 L73,75 L67,78" fill="#fff" />
      <Path d="M75,50 L95,50 L95,58 L75,58 Z" fill="#10b981" stroke="#059669" strokeWidth="1" />
    </Svg>
  );
}

// Google logo SVG
function GoogleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

// Apple logo SVG
function AppleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 814 1000">
      <Path fill="#ffffff" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46 790.8 1 694.3 1 602.1c0-86.3 14.8-50.5 42.3-131.6 28.1-79.4 68.7-139.9 119.2-174.9 50.5-35.1 111-57.5 169.2-57.5 56.5 0 107 37 160.4 37 51.7 0 109.2-39.5 175.7-39.5zm-237.2-119.2c-24.4-32.6-43.1-79.4-43.1-126.2 0-6.4.6-12.8 1.9-19.2 41.9 1.9 90.3 28.1 119.9 56.5 26.2 25.6 48.6 69.4 48.6 121.2 0 7.7-.6 15.4-1.9 21.1-3.2.6-8.4 1.3-13.5 1.3-37.5 0-81.9-24.4-111.9-54.7z" />
    </Svg>
  );
}

export default function SignUp() {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | 'email' | null>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, message: '' });
  const invalidateSession = useInvalidateSession();

  // Email signup form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(30);

  useEffect(() => {
    formOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    formTranslateY.value = withDelay(200, withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }));
  }, []);

  const formAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    setLoadingProvider(provider);
    try {
      const callbackURL = Linking.createURL("sign-in");
      console.log("[SignUp] Social sign-in", provider, "callbackURL:", callbackURL);
      const result = await (authClient.signIn as any).social({
        provider,
        callbackURL,
      });
      console.log("[SignUp] Social result:", JSON.stringify(result));
      if (result?.error) {
        playSystemSound('error');
        const errMsg = result.error?.message || result.error?.code || JSON.stringify(result.error);
        console.error("[SignUp] Social error:", errMsg);
        setErrorModal({ visible: true, message: errMsg || 'לא ניתן להתחבר כרגע.' });
      } else {
        playSystemSound('success');
        await invalidateSession();
        router.replace('/');
      }
    } catch (err: unknown) {
      console.error("[SignUp] Social exception:", err);
      playSystemSound('error');
      const msg = err instanceof Error ? err.message : String(err);
      setErrorModal({ visible: true, message: `לא ניתן להתחבר: ${msg}` });
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password || !fullName) {
      setErrorModal({ visible: true, message: "אנא מלא שם, אימייל וסיסמא" });
      return;
    }
    if (password.length < 6) {
      setErrorModal({ visible: true, message: "הסיסמא חייבת להיות לפחות 6 תווים" });
      return;
    }
    setLoadingProvider("email");
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: fullName,
      });
      console.log("[SignUp] email result:", result.data?.user?.email ?? result.error);
      if (result?.error) {
        playSystemSound('error');
        setErrorModal({ visible: true, message: result.error.message || "ההרשמה נכשלה. נסה שוב." });
      } else {
        playSystemSound('success');
        await invalidateSession();
        // After email registration, go to role selection for customer/technician choice
        router.replace('/role-select');
      }
    } catch (err: unknown) {
      console.error("[SignUp] Email signup exception:", err);
      playSystemSound('error');
      const msg = err instanceof Error ? err.message : String(err);
      setErrorModal({ visible: true, message: `שגיאה בהרשמה: ${msg}` });
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <>
    <LinearGradient
      colors={["#f0fdf4", "#dcfce7", "#bbf7d0"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 99, padding: 8 }}>
            <ArrowLeft size={24} color="#059669" />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800' }}>
              <Text style={{ color: '#10b981' }}>e</Text>
              <Text style={{ color: '#059669' }}>Bike</Text>
            </Text>
            <EBikeLogoSmall />
          </View>
        </View>

        {/* Title */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: '#1f2937', textAlign: 'right' }}>
            הצטרפות מהירה
          </Text>
          <Text style={{ color: '#6b7280', textAlign: 'right', marginTop: 6, fontSize: 16 }}>
            הירשם עם Google, Apple או אימייל וסיסמא
          </Text>
        </View>

        <Animated.View style={formAnimatedStyle}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }}>

            {/* Google Button */}
            <Pressable
              onPress={() => handleSocialSignIn('google')}
              disabled={loadingProvider !== null}
              
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                backgroundColor: '#fff',
                borderRadius: 16,
                paddingVertical: 15,
                marginBottom: 14,
                borderWidth: 1.5,
                borderColor: '#e5e7eb',
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                opacity: loadingProvider !== null ? 0.7 : 1,
              }}
            >
              {loadingProvider === 'google' ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <GoogleIcon />
              )}
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151' }}>המשך עם Google</Text>
            </Pressable>

            {/* Apple Button */}
            <Pressable
              onPress={() => handleSocialSignIn('apple')}
              disabled={loadingProvider !== null}
              
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                backgroundColor: '#000',
                borderRadius: 16,
                paddingVertical: 15,
                marginBottom: 8,
                opacity: loadingProvider !== null ? 0.7 : 1,
              }}
            >
              {loadingProvider === 'apple' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <AppleIcon />
              )}
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>המשך עם Apple</Text>
            </Pressable>

            {/* Email signup toggle + form (added for email registration after "הירשם עכשיו") */}
            <Pressable onPress={() => setShowEmailForm(v => !v)} style={{ marginTop: 8, marginBottom: 4 }}>
              <Text style={{ color: '#059669', fontSize: 13, textAlign: 'center', fontWeight: '600' }}>
                {showEmailForm ? "סגור הרשמה באימייל" : "או הירשם עם אימייל וסיסמא"}
              </Text>
            </Pressable>

            {showEmailForm && (
              <View style={{ marginTop: 8, marginBottom: 8 }}>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="שם מלא"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: '#111827',
                    fontSize: 15,
                    marginBottom: 10,
                    textAlign: 'right',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                  }}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="אימייל"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: '#111827',
                    fontSize: 15,
                    marginBottom: 10,
                    textAlign: 'right',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                  }}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="סיסמא (לפחות 6 תווים)"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: '#111827',
                    fontSize: 15,
                    marginBottom: 12,
                    textAlign: 'right',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                  }}
                />
                <Pressable
                  onPress={handleEmailSignUp}
                  disabled={loadingProvider !== null}
                  style={{
                    backgroundColor: '#10b981',
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center',
                  }}
                >
                  {loadingProvider === "email" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>הירשם עכשיו</Text>
                  )}
                </Pressable>
              </View>
            )}

            <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 }}>
              בהרשמה אתה מסכים לתנאי השימוש ומדיניות הפרטיות
            </Text>

            {/* Sign In Link */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
              <Pressable onPress={() => router.back()}>
                <Text style={{ color: '#059669', fontWeight: '700' }}>התחברות</Text>
              </Pressable>
              <Text style={{ color: '#6b7280', marginLeft: 4 }}>יש לך חשבון? </Text>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
    <ConfirmModal
      visible={errorModal.visible}
      title="שגיאה"
      message={errorModal.message}
      confirmText="סגור"
      cancelText="סגור"
      onConfirm={() => setErrorModal((s) => ({ ...s, visible: false }))}
      onCancel={() => setErrorModal((s) => ({ ...s, visible: false }))}
    />
  </>
  );
}
