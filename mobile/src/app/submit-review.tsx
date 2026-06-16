import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import ConfirmModal from "@/components/ConfirmModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Star, X, ChevronRight } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { authClient } from "@/lib/auth/auth-client";

function StarButton({
  star,
  filled,
  onPress,
}: {
  star: number;
  filled: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(1.4, { damping: 5 }), withSpring(1, { damping: 8 }));
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={animStyle}>
        <Star size={44} color="#F59E0B" fill={filled ? "#F59E0B" : "transparent"} />
      </Animated.View>
    </Pressable>
  );
}

export default function SubmitReview() {
  const { jobId, technicianName } = useLocalSearchParams<{
    jobId: string;
    technicianName: string;
  }>();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ visible: false, title: '', message: '', onConfirm: undefined as (() => void) | undefined });

  const handleStarPress = (star: number) => {
    setRating(star);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setModal({ visible: true, title: 'שגיאה', message: 'נא לבחור דירוג', onConfirm: undefined });
      return;
    }

    setLoading(true);
    try {
      const sessionResult = await authClient.getSession();
      const token = (sessionResult?.data?.session as any)?.token;

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
      const res = await fetch(`${backendUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ jobId, rating, comment: comment.trim() || undefined }),
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModal({ visible: true, title: 'תודה! 🎉', message: 'הביקורת שלך נשלחה בהצלחה', onConfirm: () => router.back() });
      } else {
        const data = await res.json();
        setModal({ visible: true, title: 'שגיאה', message: data.message || 'לא ניתן לשלוח ביקורת כעת', onConfirm: undefined });
      }
    } catch {
      setModal({ visible: true, title: 'שגיאה', message: 'בדוק את החיבור לאינטרנט ונסה שוב', onConfirm: undefined });
    } finally {
      setLoading(false);
    }
  };

  const ratingLabels = ["", "גרוע", "לא טוב", "בסדר", "טוב", "מעולה"];

  return (
    <>
    <LinearGradient
      colors={["#f0fdf4", "#dcfce7", "#f9fafb"]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.8)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={22} color="#374151" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
            השאר ביקורת
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Technician name */}
          <View style={{ alignItems: "center", marginTop: 24, marginBottom: 32 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#d1fae5",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 32 }}>🔧</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>
              {technicianName || "הטכנאי"}
            </Text>
            <Text style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
              כיצד היה השירות?
            </Text>
          </View>

          {/* Star rating */}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 24,
              padding: 24,
              marginBottom: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: "#374151",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              בחר דירוג
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <StarButton
                  key={star}
                  star={star}
                  filled={star <= rating}
                  onPress={() => handleStarPress(star)}
                />
              ))}
            </View>
            {rating > 0 && (
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#F59E0B",
                }}
              >
                {ratingLabels[rating]}
              </Text>
            )}
          </View>

          {/* Comment */}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 24,
              padding: 20,
              marginBottom: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: "#374151",
                textAlign: "right",
                marginBottom: 12,
              }}
            >
              הוסף תגובה (אופציונלי)
            </Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="ספר לנו על החוויה שלך..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{
                backgroundColor: "#f9fafb",
                borderRadius: 16,
                padding: 14,
                fontSize: 15,
                color: "#111827",
                textAlign: "right",
                minHeight: 100,
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
            />
          </View>

          {/* Submit button */}
          <Pressable onPress={handleSubmit} disabled={loading}>
            <LinearGradient
              colors={["#10b981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 18, padding: 18 }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontWeight: "700",
                      fontSize: 17,
                    }}
                  >
                    שלח ביקורת
                  </Text>
                  <ChevronRight size={20} color="white" />
                </View>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
        <ConfirmModal
          visible={modal.visible}
          title={modal.title}
          message={modal.message}
          confirmText={modal.onConfirm ? 'סגור' : 'סגור'}
          cancelText="סגור"
          onConfirm={() => {
            setModal((s) => ({ ...s, visible: false }));
            modal.onConfirm?.();
          }}
          onCancel={() => setModal((s) => ({ ...s, visible: false }))}
        />
      </SafeAreaView>
    </LinearGradient>
    </>
  );
}
