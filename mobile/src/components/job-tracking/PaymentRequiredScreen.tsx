import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import { brand, gradients } from '@/lib/brand-colors';
import { useLanguageStore } from '@/lib/store';
import { DotLoader } from './DotLoader';

export function PaymentRequiredScreen({
  technician,
  totalPrice,
  onPayNow,
  onCancel,
  onSimulatePay,
  mockPayments,
  paymentLoading,
}: {
  technician?: { name?: string; avatar_url?: string };
  totalPrice: number;
  onPayNow: () => void;
  onCancel: () => void;
  onSimulatePay?: () => void;
  mockPayments?: boolean;
  paymentLoading: boolean;
}) {
  const insets = useSafeAreaInsets();
  const t = useLanguageStore((s) => s.t);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 12 });
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <LinearGradient colors={['#0F172A', '#0D2137', '#0F172A']} style={{ flex: 1 }}>
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          style={{ alignItems: 'center', paddingTop: insets.top + 40, paddingBottom: 32, paddingHorizontal: 32 }}
        >
          <Animated.View
            style={[
              {
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: '#166534',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              },
              checkStyle,
            ]}
          >
            <Check size={36} color="#fff" />
          </Animated.View>
          <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
            הטכנאי מוכן לצאת!
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            כדי לאשר את הביקור, יש לשלם כעת
          </Text>
        </Animated.View>

        {technician && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={{
              marginHorizontal: 24,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: brand.primaryDeeper }}>
              {technician.avatar_url ? (
                <Image source={{ uri: technician.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28 }} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{technician.name?.charAt(0) ?? '?'}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 17, fontWeight: '700' }}>{technician.name}</Text>
              <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>טכנאי מוסמך • ממתין לתשלום</Text>
            </View>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={{
            marginHorizontal: 24,
            marginBottom: 24,
            backgroundColor: 'rgba(59,130,246,0.12)',
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(59,130,246,0.3)',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>
            {t('paymentTotal')}: ₪{totalPrice}
          </Text>
          <Text style={{ color: brand.primaryLight, fontSize: 52, fontWeight: '900' }}>₪{totalPrice}</Text>
          <Text style={{ color: '#475569', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
            {t('fixedPriceSubtitle')}
          </Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 12 }}
        >
          <Pressable
            onPress={onPayNow}
            disabled={paymentLoading}
            style={({ pressed }) => ({ opacity: pressed || paymentLoading ? 0.85 : 1, borderRadius: 16, overflow: 'hidden' })}
          >
            <LinearGradient
              colors={[...gradients.primaryDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            >
              {paymentLoading ? (
                <>
                  <DotLoader delay={0} />
                  <DotLoader delay={200} />
                  <DotLoader delay={400} />
                </>
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
                  {mockPayments ? '💳 שלם (תשלום לדוגמה)' : '💳  שלם עכשיו'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          {onSimulatePay && (
            <Pressable
              onPress={onSimulatePay}
              disabled={paymentLoading}
              style={({ pressed }) => ({
                marginTop: 8,
                opacity: pressed || paymentLoading ? 0.6 : 1,
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FECACA',
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: 'center',
              })}
            >
              <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 14 }}>
                ⚡ תשלום מיידי ללא כרטיס (בדיקה)
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.25)',
            })}
          >
            <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15 }}>בטל הזמנה</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}