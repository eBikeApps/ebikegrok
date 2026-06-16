import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { User, Wrench } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useQueryClient } from '@tanstack/react-query';

export default function RoleSelectScreen() {
  const customerScale = useSharedValue(1);
  const technicianScale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const [saving, setSaving] = useState<'customer' | 'technician' | null>(null);
  const queryClient = useQueryClient();
  const [errorModal, setErrorModal] = useState({ visible: false, message: '' });

  React.useEffect(() => {
    opacity.value = withDelay(200, withTiming(1, { duration: 600 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const saveRole = async (role: 'customer' | 'technician') => {
    setSaving(role);
    try {
      await api.patch('/api/users/me', { role });
      queryClient.removeQueries({ queryKey: ['me'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorModal({ visible: true, message: msg });
      setSaving(null);
      return false;
    }
    setSaving(null);
    return true;
  };

  const handleCustomerPress = async () => {
    if (saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    customerScale.value = withSpring(0.95, {}, () => {
      customerScale.value = withSpring(1);
    });
    const ok = await saveRole('customer');
    if (ok) router.replace('/(customer)/(tabs)');
  };

  const handleTechnicianPress = async () => {
    if (saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    technicianScale.value = withSpring(0.95, {}, () => {
      technicianScale.value = withSpring(1);
    });
    const ok = await saveRole('technician');
    if (ok) router.replace('/(customer)/(tabs)');
  };

  const customerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: customerScale.value }],
  }));

  const technicianAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: technicianScale.value }],
  }));

  return (
    <>
    <LinearGradient
      colors={['#f0fdf4', '#dcfce7', '#bbf7d0']}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[{ flex: 1, justifyContent: 'center', padding: 24 }, animatedStyle]}>
            {/* Title */}
            <View className="mb-12">
              <Text className="text-4xl font-bold text-gray-800 text-center mb-2">
                <Text style={{ color: '#10b981' }}>e</Text>
                <Text style={{ color: '#059669' }}>Bike</Text>
              </Text>
              <Text className="text-2xl font-bold text-gray-800 text-center mt-4">
                בחר את התפקיד שלך
              </Text>
              <Text className="text-gray-600 text-center mt-2">
                איך תרצה להשתמש באפליקציה?
              </Text>
            </View>

            {/* Customer Card */}
            <Animated.View style={customerAnimatedStyle}>
              <Pressable
                onPress={handleCustomerPress}
                disabled={saving !== null}
                className="mb-6"
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 24,
                    padding: 32,
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 16,
                    elevation: 8,
                    opacity: saving !== null ? 0.7 : 1,
                  }}
                >
                  <View className="items-center">
                    <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-4">
                      {saving === 'customer' ? <ActivityIndicator color="#fff" size="large" /> : <User size={40} color="#fff" />}
                    </View>
                    <Text className="text-2xl font-bold text-white mb-2">
                      לקוח
                    </Text>
                    <Text className="text-white/90 text-center text-base">
                      זקוק לתיקון אופניים חשמליים?{'\n'}
                      מצא טכנאים מקצועיים בקרבתך
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Technician Card */}
            <Animated.View style={technicianAnimatedStyle}>
              <Pressable
                onPress={handleTechnicianPress}
                disabled={saving !== null}
                className="mb-6"
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 24,
                    padding: 32,
                    shadowColor: '#10b981',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 16,
                    elevation: 8,
                    opacity: saving !== null ? 0.7 : 1,
                  }}
                >
                  <View className="items-center">
                    <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-4">
                      {saving === 'technician' ? <ActivityIndicator color="#fff" size="large" /> : <Wrench size={40} color="#fff" />}
                    </View>
                    <Text className="text-2xl font-bold text-white mb-2">
                      טכנאי
                    </Text>
                    <Text className="text-white/90 text-center text-base">
                      טכנאי מקצועי לאופניים חשמליים?{'\n'}
                      התחבר וקבל הזמנות בקרבתך
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </ScrollView>
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
