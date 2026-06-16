import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import {
  ChevronLeft,
  Wrench,
  Zap,
  CircleDot,
  Settings,
  Send,
  CheckCircle2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/api';

type RepairOption = {
  id: string;
  labelHe: string;
  icon: React.ReactNode;
  suggestedPrice: number;
};

const REPAIR_OPTIONS: RepairOption[] = [
  { id: 'front_tire', labelHe: 'פנצ׳ר קדמי', icon: <CircleDot size={18} color="#60A5FA" />, suggestedPrice: 200 },
  { id: 'rear_tire', labelHe: 'פנצ׳ר אחורי', icon: <CircleDot size={18} color="#60A5FA" />, suggestedPrice: 200 },
  { id: 'brake', labelHe: 'תיקון בלמים', icon: <Settings size={18} color="#F97316" />, suggestedPrice: 200 },
  { id: 'electrical', labelHe: 'תקלה חשמלית', icon: <Zap size={18} color="#FBBF24" />, suggestedPrice: 250 },
  { id: 'general', labelHe: 'שירות כללי', icon: <Wrench size={18} color="#A78BFA" />, suggestedPrice: 300 },
  { id: 'parts', labelHe: 'חלקי חילוף', icon: <Settings size={18} color="#34D399" />, suggestedPrice: 150 },
];

export default function ExtraRepairScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jobId, customerName } = useLocalSearchParams<{
    jobId: string;
    customerName?: string;
  }>();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [sent, setSent] = useState(false);

  const selectedRepair = REPAIR_OPTIONS.find((r) => r.id === selectedOption);

  const handleSelectOption = (id: string) => {
    Haptics.selectionAsync();
    const option = REPAIR_OPTIONS.find((r) => r.id === id);
    setSelectedOption(id);
    if (option && !amount) {
      setAmount(String(option.suggestedPrice));
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/api/payments/extra-repair/${jobId}`, {
        description: customDescription || selectedRepair?.labelHe || 'תיקון נוסף',
        amount: Number(amount),
        repairType: selectedOption,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const canSend = (selectedOption || customDescription.trim().length > 2) && Number(amount) >= 50;

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
        <LinearGradient
          colors={['#0A1628', '#0F172A']}
          style={{
            flex: 1, alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 32, paddingBottom: insets.bottom + 24,
          }}
        >
          <Animated.View entering={FadeInUp.duration(400).springify()} style={{ alignItems: 'center' }}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: 'rgba(16,185,129,0.15)',
              borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            }}>
              <CheckCircle2 size={44} color="#10B981" />
            </View>
            <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 }}>
              הבקשה נשלחה!
            </Text>
            <Text style={{ color: '#64748B', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              {customerName ?? 'הלקוח'} יקבל התראה{'\n'}לאשר את התשלום
            </Text>

            <Pressable
              onPress={() => router.back()}
              style={{ marginTop: 36 }}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>חזרה לעבודה</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0F172A' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 6,
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: 'rgba(255,255,255,0.07)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronLeft size={20} color="#94A3B8" />
        </Pressable>
        <View>
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>
            תיקון נוסף
          </Text>
          <Text style={{ color: '#475569', fontSize: 13 }}>
            שלח בקשת תשלום ל{customerName ?? 'לקוח'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Repair type grid */}
        <Animated.View entering={FadeInUp.delay(50).duration(350)}>
          <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>
            סוג תיקון
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {REPAIR_OPTIONS.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => handleSelectOption(opt.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    borderRadius: 14,
                    backgroundColor: isSelected ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: isSelected ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.07)',
                  }}
                >
                  {opt.icon}
                  <Text style={{
                    color: isSelected ? '#93C5FD' : '#CBD5E1',
                    fontSize: 13,
                    fontWeight: isSelected ? '700' : '500',
                  }}>
                    {opt.labelHe}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Custom description */}
        <Animated.View entering={FadeInUp.delay(100).duration(350)} style={{ marginTop: 24 }}>
          <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', marginBottom: 10, letterSpacing: 0.5 }}>
            תיאור (אופציונלי)
          </Text>
          <TextInput
            value={customDescription}
            onChangeText={setCustomDescription}
            placeholder="תאר את התיקון הנוסף…"
            placeholderTextColor="#334155"
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
              color: '#E2E8F0',
              fontSize: 15,
              textAlignVertical: 'top',
              minHeight: 80,
            }}
          />
        </Animated.View>

        {/* Amount */}
        <Animated.View entering={FadeInUp.delay(150).duration(350)} style={{ marginTop: 24 }}>
          <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', marginBottom: 10, letterSpacing: 0.5 }}>
            סכום לחיוב
          </Text>
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1,
            borderColor: amount && Number(amount) >= 50 ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)',
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            height: 60,
          }}>
            <Text style={{ color: '#475569', fontSize: 24, fontWeight: '700', marginLeft: 8 }}>₪</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#334155"
              style={{
                flex: 1,
                color: '#F8FAFC',
                fontSize: 28,
                fontWeight: '800',
                letterSpacing: -0.5,
              }}
            />
          </View>
          {/* Quick amounts */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {[150, 200, 250, 300].map((val) => (
              <Pressable
                key={val}
                onPress={() => { Haptics.selectionAsync(); setAmount(String(val)); }}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 10,
                  backgroundColor: amount === String(val)
                    ? 'rgba(59,130,246,0.2)'
                    : 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: amount === String(val)
                    ? 'rgba(59,130,246,0.4)'
                    : 'rgba(255,255,255,0.07)',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: amount === String(val) ? '#93C5FD' : '#64748B',
                  fontSize: 13,
                  fontWeight: '600',
                }}>
                  ₪{val}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Info note */}
        {canSend && (
          <Animated.View
            entering={FadeIn.duration(250)}
            style={{
              marginTop: 20,
              backgroundColor: 'rgba(59,130,246,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(59,130,246,0.15)',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <Text style={{ color: '#60A5FA', fontSize: 13, lineHeight: 20 }}>
              {customerName ?? 'הלקוח'} יקבל התראה לאשר תשלום של ₪{Number(amount).toLocaleString()}.
              לאחר התשלום תוכל להמשיך בתיקון.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Send button */}
      <View style={{
        position: 'absolute',
        bottom: insets.bottom + 16,
        left: 20,
        right: 20,
      }}>
        <Pressable
          onPress={() => canSend && mutation.mutate()}
          disabled={!canSend || mutation.isPending}
        >
          <LinearGradient
            colors={canSend ? ['#3B82F6', '#2563EB'] : ['#1E293B', '#1E293B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 18,
              paddingVertical: 17,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
              opacity: canSend ? 1 : 0.5,
            }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  שלח בקשת תשלום ללקוח
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
        {mutation.isError && (
          <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            שגיאה בשליחה, אנא נסה שנית
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
