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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import {
  X,
  Wallet,
  Building2,
  CheckCircle2,
  ChevronDown,
  Info,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/use-session';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

const BANK_LIST = [
  'בנק הפועלים', 'בנק לאומי', 'בנק דיסקונט', 'בנק מזרחי-טפחות',
  'בנק הבינלאומי', 'בנק ירושלים', 'בנק מרכנתיל', 'One Zero',
];

export default function WithdrawalRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: sessionData } = useSession();
  const token = (sessionData as any)?.session?.token as string | undefined;

  const authedFetch = async (path: string) => {
    if (!token) throw new Error('No session');
    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };

  const balanceQuery = useQuery({
    queryKey: ['technician', 'balance', token],
    queryFn: () => authedFetch('/api/technician/balance'),
    enabled: !!token,
    staleTime: 30_000,
  });

  const balance: number = balanceQuery.data?.balance ?? 0;

  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchNumber, setBranchNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const amountNum = Number(amount ?? 0);
  // T07/T08 FIX: client mirrors server regex so user sees error before round-trip
  const isValidAmount = Number.isFinite(amountNum) && amountNum >= 50 && amountNum <= balance && amountNum <= 10000;
  const branchOk = /^\d{3,6}$/.test(branchNumber.trim());
  const accountOk = /^\d{6,20}$/.test(accountNumber.trim());
  const canSubmit =
    isValidAmount &&
    bankName.trim().length > 0 &&
    branchOk &&
    accountOk &&
    accountHolder.trim().length > 2;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No session');
      const res = await fetch(`${BACKEND_URL}/api/technician/withdrawal-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          bankName,
          branchNumber,
          accountNumber,
          accountHolder,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['technician', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['technician', 'transactions'] });
      setSubmitted(true);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <LinearGradient
          colors={['#F0FDF4', '#F8FAFC', '#F8FAFC']}
          style={{
            flex: 1, alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 32, paddingBottom: insets.bottom + 24,
          }}
        >
          <Animated.View entering={FadeInUp.duration(400).springify()} style={{ alignItems: 'center' }}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: '#DCFCE7',
              borderWidth: 1.5, borderColor: '#86EFAC',
              alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            }}>
              <CheckCircle2 size={44} color="#16A34A" />
            </View>
            <Text style={{ color: '#0F172A', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 10 }}>
              הבקשה התקבלה!
            </Text>
            <Text style={{ color: '#64748B', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              בקשת המשיכה עבור ₪{amountNum.toLocaleString()} נשלחה{'\n'}ותטופל תוך 1-3 ימי עסקים
            </Text>

            <View style={{
              marginTop: 24,
              backgroundColor: '#FFF7ED',
              borderWidth: 1, borderColor: '#FED7AA',
              borderRadius: 16, padding: 16,
              flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            }}>
              <Info size={16} color="#F97316" style={{ marginTop: 1 }} />
              <Text style={{ color: '#9A3412', fontSize: 13, flex: 1, lineHeight: 19 }}>
                ההעברה תבוצע לחשבון {bankName} שסיפקת. נשלח לך אישור ב-SMS.
              </Text>
            </View>

            <Pressable onPress={() => router.back()} style={{ marginTop: 32 }}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>חזרה לרווחים</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 10,
        paddingBottom: 16,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={18} color="#64748B" />
        </Pressable>
        <Text style={{ color: '#0F172A', fontSize: 17, fontWeight: '700' }}>משיכת כספים</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <Animated.View entering={FadeInUp.delay(50).duration(350)}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 20, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 14 }}
          >
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Wallet size={22} color="#fff" />
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>יתרה זמינה למשיכה</Text>
              {balanceQuery.isLoading ? (
                <ActivityIndicator color="#fff" style={{ marginTop: 4 }} />
              ) : (
                <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5 }}>
                  ₪{balance.toLocaleString()}
                </Text>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Amount input */}
        <Animated.View entering={FadeInUp.delay(100).duration(350)}>
          <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600', marginBottom: 10, letterSpacing: 0.3 }}>
            סכום למשיכה
          </Text>
          <View style={{
            backgroundColor: '#fff',
            borderWidth: 1.5,
            borderColor: amountNum > 0 && isValidAmount ? '#10B981'
              : amountNum > 0 && !isValidAmount ? '#EF4444'
              : '#E2E8F0',
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            height: 64,
            shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
          }}>
            <Text style={{ color: '#94A3B8', fontSize: 26, fontWeight: '700', marginLeft: 8 }}>₪</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#CBD5E1"
              style={{ flex: 1, color: '#0F172A', fontSize: 32, fontWeight: '800', letterSpacing: -1 }}
            />
            {balance > 0 && (
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setAmount(String(balance)); }}
                style={{
                  backgroundColor: '#ECFDF5', paddingHorizontal: 12,
                  paddingVertical: 6, borderRadius: 10,
                }}
              >
                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>כל היתרה</Text>
              </Pressable>
            )}
          </View>
          {amountNum > 0 && amountNum < 50 && (
            <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>סכום מינימלי למשיכה: ₪50</Text>
          )}
          {amountNum > balance && (
            <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>הסכום גבוה מהיתרה הזמינה</Text>
          )}
        </Animated.View>

        {/* Bank details */}
        <Animated.View entering={FadeInUp.delay(150).duration(350)} style={{ marginTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Building2 size={16} color="#64748B" />
            <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 }}>
              פרטי חשבון בנק
            </Text>
          </View>

          {/* Bank name picker */}
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setShowBankPicker((s) => !s); }}
            style={{
              backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
              borderRadius: 14, paddingHorizontal: 16, height: 52,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10,
              shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
            }}
          >
            <Text style={{ color: bankName ? '#0F172A' : '#94A3B8', fontSize: 15, fontWeight: bankName ? '600' : '400' }}>
              {bankName || 'בחר בנק'}
            </Text>
            <ChevronDown size={16} color="#94A3B8" />
          </Pressable>

          {/* Bank list dropdown */}
          {showBankPicker && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{
                backgroundColor: '#fff',
                borderWidth: 1, borderColor: '#E2E8F0',
                borderRadius: 14, marginBottom: 10, overflow: 'hidden',
                shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
              }}
            >
              {BANK_LIST.map((bank, i) => (
                <Pressable
                  key={bank}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setBankName(bank);
                    setShowBankPicker(false);
                  }}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 13,
                    borderBottomWidth: i < BANK_LIST.length - 1 ? 1 : 0,
                    borderBottomColor: '#F1F5F9',
                    backgroundColor: bankName === bank ? '#F0FDF4' : '#fff',
                  }}
                >
                  <Text style={{
                    color: bankName === bank ? '#16A34A' : '#334155',
                    fontWeight: bankName === bank ? '700' : '400',
                    fontSize: 15,
                  }}>
                    {bank}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          )}

          {/* Branch + Account */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>מספר סניף</Text>
              <TextInput
                value={branchNumber}
                onChangeText={setBranchNumber}
                placeholder="000"
                placeholderTextColor="#CBD5E1"
                keyboardType="numeric"
                maxLength={5}
                style={{
                  backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
                  borderRadius: 14, paddingHorizontal: 16, height: 52,
                  color: '#0F172A', fontSize: 15, fontWeight: '600',
                  textAlign: 'center',
                }}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>מספר חשבון</Text>
              <TextInput
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="000000000"
                placeholderTextColor="#CBD5E1"
                keyboardType="numeric"
                maxLength={12}
                style={{
                  backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
                  borderRadius: 14, paddingHorizontal: 16, height: 52,
                  color: '#0F172A', fontSize: 15, fontWeight: '600',
                }}
              />
            </View>
          </View>

          {/* Account holder */}
          <View>
            <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>שם בעל החשבון</Text>
            <TextInput
              value={accountHolder}
              onChangeText={setAccountHolder}
              placeholder="שם מלא"
              placeholderTextColor="#CBD5E1"
              style={{
                backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
                borderRadius: 14, paddingHorizontal: 16, height: 52,
                color: '#0F172A', fontSize: 15, fontWeight: '600',
              }}
            />
          </View>
        </Animated.View>

        {/* Info */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(350)}
          style={{
            marginTop: 20,
            backgroundColor: '#EFF6FF',
            borderWidth: 1, borderColor: '#BFDBFE',
            borderRadius: 14, padding: 14,
            flexDirection: 'row', gap: 10,
          }}
        >
          <Info size={15} color="#3B82F6" style={{ marginTop: 1 }} />
          <Text style={{ color: '#1E40AF', fontSize: 13, flex: 1, lineHeight: 20 }}>
            ההעברה מבוצעת תוך 1-3 ימי עסקים. עמלת העברה: ₪0
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Submit button */}
      <View style={{
        position: 'absolute', bottom: insets.bottom + 16,
        left: 20, right: 20,
      }}>
        <Pressable
          onPress={() => canSubmit && mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
        >
          <LinearGradient
            colors={canSubmit ? ['#10B981', '#059669'] : ['#E2E8F0', '#E2E8F0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 18, paddingVertical: 17,
              alignItems: 'center', justifyContent: 'center',
              opacity: canSubmit ? 1 : 0.7,
            }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{
                color: canSubmit ? '#fff' : '#94A3B8',
                fontWeight: '700', fontSize: 16,
              }}>
                {canSubmit
                  ? `שלח בקשת משיכה · ₪${amountNum.toLocaleString()}`
                  : 'מלא את כל הפרטים'}
              </Text>
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
