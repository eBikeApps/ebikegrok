import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ImageBackground,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
} from "react-native";
import ConfirmModal from "@/components/ConfirmModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { authClient } from "@/lib/auth/auth-client";
import { refreshSessionAfterAuth } from "@/lib/auth/use-session";
import { useQueryClient } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import * as Linking from "expo-linking";
import { playSystemSound } from "@/lib/system-sounds";
import { LinearGradient } from "expo-linear-gradient";
import { EBikeLogo, GoogleIcon, AppleIconWhite, SocialButton3D } from "@/components/auth/AuthUi";
import { useLanguageStore } from "@/lib/store";

export default function SignUp() {
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | "email" | null>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, message: "" });
  const queryClient = useQueryClient();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(40);

  useEffect(() => {
    contentOpacity.value = withDelay(500, withTiming(1, { duration: 700 }));
    contentTranslateY.value = withDelay(500, withTiming(0, { duration: 700, easing: Easing.out(Easing.back(1.2)) }));
  }, []);

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  const handleSocialSignIn = async (provider: "google" | "apple") => {
    setLoadingProvider(provider);
    try {
      const callbackURL = Linking.createURL("sign-in");
      const result = await (authClient.signIn as any).social({ provider, callbackURL });
      if (result?.error) {
        playSystemSound("error");
        const errMsg = result.error?.message || result.error?.code || JSON.stringify(result.error);
        setErrorModal({ visible: true, message: errMsg || t("somethingWentWrong") });
      } else {
        playSystemSound("success");
        const ready = await refreshSessionAfterAuth(queryClient);
        if (ready) {
          router.replace("/");
        } else {
          setErrorModal({
            visible: true,
            message: t("somethingWentWrong"),
          });
        }
      }
    } catch (err: unknown) {
      playSystemSound("error");
      const msg = err instanceof Error ? err.message : String(err);
      setErrorModal({ visible: true, message: msg });
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password || !fullName) {
      setErrorModal({
        visible: true,
        message: language === "he" ? "אנא מלא שם, אימייל וסיסמא" : "Please fill name, email and password",
      });
      return;
    }
    if (password.length < 6) {
      setErrorModal({
        visible: true,
        message: language === "he" ? "הסיסמא חייבת להיות לפחות 6 תווים" : "Password must be at least 6 characters",
      });
      return;
    }
    setLoadingProvider("email");
    try {
      const result = await authClient.signUp.email({ email, password, name: fullName });
      if (result?.error) {
        playSystemSound("error");
        const raw = result.error.message || "";
        const friendly =
          raw.includes("disabled") || raw.includes("410") || raw.includes("403")
            ? "הרשמה באימייל אינה זמינה כרגע. נסה Google/Apple."
            : raw.includes("already") || raw.includes("exists")
              ? "כתובת האימייל כבר רשומה. נסה להתחבר."
              : raw || "ההרשמה נכשלה. נסה שוב.";
        setErrorModal({ visible: true, message: friendly });
      } else {
        playSystemSound("success");
        const ready = await refreshSessionAfterAuth(queryClient);
        if (ready) {
          router.replace("/");
        } else {
          setErrorModal({ visible: true, message: t("somethingWentWrong") });
        }
      }
    } catch (err: unknown) {
      playSystemSound("error");
      const msg = err instanceof Error ? err.message : String(err);
      setErrorModal({ visible: true, message: msg });
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ImageBackground source={require("@/assets/images/sign-in-bg.jpg")} style={{ flex: 1 }} resizeMode="cover">
        <LinearGradient
          colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.72)"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <SafeAreaView style={{ flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ position: "absolute", top: 56, left: I18nManager.isRTL ? undefined : 20, right: I18nManager.isRTL ? 20 : undefined, zIndex: 10, padding: 8 }}
          >
            <BackIcon size={26} color="rgba(255,255,255,0.85)" />
          </Pressable>

          <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: "space-between", paddingBottom: 12 }}>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 }}>
              <EBikeLogo />
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500", marginTop: 24, letterSpacing: 3 }}>
                eBike
              </Text>
            </View>

            <Animated.View style={contentAnimatedStyle}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", marginBottom: 22, letterSpacing: 0.5 }}>
                הצטרפות מהירה
              </Text>

              <SocialButton3D
                variant="google"
                label={t("continueWithGoogle")}
                icon={<GoogleIcon />}
                onPress={() => handleSocialSignIn("google")}
                loading={loadingProvider === "google"}
                disabled={loadingProvider !== null}
              />
              <SocialButton3D
                variant="apple"
                label={t("continueWithApple")}
                icon={<AppleIconWhite />}
                onPress={() => handleSocialSignIn("apple")}
                loading={loadingProvider === "apple"}
                disabled={loadingProvider !== null}
              />

              {showEmailForm && (
                <View style={{ marginTop: 4, marginBottom: 8 }}>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="שם מלא"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="words"
                    style={inputStyle}
                  />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="אימייל"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={inputStyle}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="סיסמא (לפחות 6 תווים)"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry
                    style={inputStyle}
                  />
                  <Pressable
                    onPress={handleEmailSignUp}
                    disabled={loadingProvider !== null}
                    style={{ backgroundColor: "#10b981", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
                  >
                    {loadingProvider === "email" ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>הירשם עכשיו</Text>
                    )}
                  </Pressable>
                </View>
              )}

              <Pressable onPress={() => setShowEmailForm((v) => !v)} style={{ marginBottom: 10 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center" }}>
                  {showEmailForm ? "סגור" : "הרשמה עם אימייל וסיסמא"}
                </Text>
              </Pressable>

              <View style={{ flexDirection: I18nManager.isRTL ? "row-reverse" : "row", justifyContent: "center", marginBottom: 12 }}>
                <Pressable onPress={() => router.back()}>
                  <Text style={{ color: "#10b981", fontWeight: "700" }}>התחברות</Text>
                </Pressable>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginHorizontal: 4 }}>יש לך חשבון?</Text>
              </View>

              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textAlign: "center", lineHeight: 16 }}>
                בהרשמה אתה מסכים ל
                <Text style={{ color: "#10b981" }} onPress={() => router.push({ pathname: "/legal", params: { type: "terms" } })}>
                  {" "}תנאי השימוש{" "}
                </Text>
                ול
                <Text style={{ color: "#10b981" }} onPress={() => router.push({ pathname: "/legal", params: { type: "privacy" } })}>
                  מדיניות הפרטיות
                </Text>
              </Text>
            </Animated.View>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <ConfirmModal
        visible={errorModal.visible}
        title={t("error")}
        message={errorModal.message}
        alertOnly
        confirmText={t("close")}
        onConfirm={() => setErrorModal((s) => ({ ...s, visible: false }))}
        onCancel={() => setErrorModal((s) => ({ ...s, visible: false }))}
      />
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "rgba(255,255,255,0.12)",
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 14,
  color: "#fff",
  fontSize: 15,
  marginBottom: 10,
  textAlign: "right" as const,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.2)",
};