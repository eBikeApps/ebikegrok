import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, Linking, Platform, StyleSheet } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, {
  FadeInUp,
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Phone, MessageCircle, X, Check, Clock, Wrench, MapPin, ChevronRight, Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useLanguageStore, useActiveJobStore, useLocationStore } from '@/lib/store';
import { JobStatus } from '@/lib/types';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api/api';
import { dialPhoneNumber } from '@/lib/phone';

const statusSteps: { key: JobStatus; labelKey: string; icon: string; timestampField: keyof typeof timestampFields }[] = [
  { key: 'accepted', labelKey: 'technicianSetOff', icon: '🚀', timestampField: 'accepted_at' },
  { key: 'on_way', labelKey: 'technicianAlmostHere', icon: '🚗', timestampField: 'on_way_at' },
  { key: 'arrived', labelKey: 'technicianArrived', icon: '📍', timestampField: 'arrived_at' },
  { key: 'in_progress', labelKey: 'repairInProgress', icon: '🔧', timestampField: 'in_progress_at' },
];

// dummy ref for TS keyof check
const timestampFields = {
  accepted_at: '', on_way_at: '', arrived_at: '', in_progress_at: '',
};

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcEta(distanceKm: number): number {
  return Math.max(1, Math.ceil((distanceKm / 25) * 60) + 5);
}

function formatTime(isoString?: string): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function PulseDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.4, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 800 }), withTiming(0.6, { duration: 800 })),
      -1,
      false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#22C55E',
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#16A34A',
        }}
      />
    </View>
  );
}

function WaitingScreen({ onCancel }: { onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const animate = async () => {
      ring1.value = withRepeat(
        withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 0 })),
        -1, false
      );
      await delay(600);
      ring2.value = withRepeat(
        withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 0 })),
        -1, false
      );
      await delay(600);
      ring3.value = withRepeat(
        withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 0 })),
        -1, false
      );
    };
    animate();
    iconScale.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1, true
    );
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.3, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.6, 1.8]) }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.3, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.6, 1.8]) }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring3.value, [0, 0.3, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(ring3.value, [0, 1], [0.6, 1.8]) }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Rings animation */}
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{
            position: 'absolute', width: 200, height: 200, borderRadius: 100,
            borderWidth: 2, borderColor: '#3B82F6',
          }, ring3Style]} />
          <Animated.View style={[{
            position: 'absolute', width: 160, height: 160, borderRadius: 80,
            borderWidth: 2, borderColor: '#3B82F6',
          }, ring2Style]} />
          <Animated.View style={[{
            position: 'absolute', width: 120, height: 120, borderRadius: 60,
            borderWidth: 2, borderColor: '#3B82F6',
          }, ring1Style]} />

          <Animated.View style={iconStyle}>
            <LinearGradient
              colors={['#3B82F6', '#1D4ED8']}
              style={{
                width: 88, height: 88, borderRadius: 44,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.5, shadowRadius: 20,
              }}
            >
              <Search size={38} color="#fff" />
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ alignItems: 'center', marginTop: 36, paddingHorizontal: 32 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
            מחפשים טכנאי...
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
            ממתינים לאישור טכנאי שיגיע אליך בהקדם
          </Text>
        </Animated.View>

        {/* Dots loader */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={{ flexDirection: 'row', gap: 8, marginTop: 32 }}>
          {[0, 1, 2].map((i) => (
            <DotLoader key={i} delay={i * 200} />
          ))}
        </Animated.View>

        {/* Info card */}
        <Animated.View
          entering={FadeInUp.delay(700).duration(500)}
          style={{
            marginTop: 48, marginHorizontal: 24,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 20, padding: 20,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>זמן ממוצע לאישור</Text>
              <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>בדרך כלל עד 2-3 דקות</Text>
            </View>
          </View>
        </Animated.View>

        {/* Cancel button */}
        <Animated.View entering={FadeInUp.delay(900).duration(400)} style={{ marginTop: 'auto', paddingBottom: insets.bottom + 24, paddingHorizontal: 24, width: '100%' }}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
              borderRadius: 16, paddingVertical: 16,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
            })}
          >
            <X size={18} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600' }}>בטל הזמנה</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

function DotLoader({ delay }: { delay: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    setTimeout(() => {
      y.value = withRepeat(
        withSequence(withTiming(-8, { duration: 400 }), withTiming(0, { duration: 400 })),
        -1, false
      );
    }, delay);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }, style]} />;
}

function PaymentRequiredScreen({
  technician,
  amount,
  onPayNow,
  onCancel,
  onSimulatePay,
  paymentLoading,
}: {
  technician?: any;
  amount: number;
  onPayNow: () => void;
  onCancel: () => void;
  onSimulatePay?: () => void;
  paymentLoading: boolean;
}) {
  const insets = useSafeAreaInsets();
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
        {/* Header */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          style={{ alignItems: 'center', paddingTop: insets.top + 40, paddingBottom: 32, paddingHorizontal: 32 }}
        >
          <Animated.View style={[{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: '#166534',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }, checkStyle]}>
            <Check size={36} color="#fff" />
          </Animated.View>
          <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
            הטכנאי מוכן לצאת!
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            כדי לאשר את הביקור, יש לשלם כעת
          </Text>
        </Animated.View>

        {/* Technician card */}
        {technician && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={{
              marginHorizontal: 24,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 20, padding: 20,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
              flexDirection: 'row', alignItems: 'center', gap: 16,
              marginBottom: 20,
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: '#1D4ED8' }}>
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

        {/* Price card */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={{
            marginHorizontal: 24, marginBottom: 24,
            backgroundColor: 'rgba(59,130,246,0.12)',
            borderRadius: 20, padding: 24,
            borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>סכום לתשלום</Text>
          <Text style={{ color: '#60A5FA', fontSize: 52, fontWeight: '900' }}>₪{amount}</Text>
          <Text style={{ color: '#475569', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
            המחיר הסופי ייקבע לאחר הבדיקה
          </Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* Buttons */}
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
              colors={['#3B82F6', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            >
              {paymentLoading
                ? <><DotLoader delay={0} /><DotLoader delay={200} /><DotLoader delay={400} /></>
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>💳  שלם עכשיו</Text>
              }
            </LinearGradient>
          </Pressable>

          {/* DEV simulate button - bulletproof dev testing for the pay-after-accept-before-drive requirement */}
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
              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>
                🧪 DEV: סמלץ תשלום הצלחה (לבדיקה בלבד)
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
              borderRadius: 16, paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
            })}
          >
            <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15 }}>בטל הזמנה</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

function CancellingScreen() {
  const bikeX = useSharedValue(-60);
  const bikeY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const sparkle1 = useSharedValue(0);
  const sparkle2 = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    bikeX.value = withRepeat(
      withSequence(
        withTiming(420, { duration: 2200 }),
        withTiming(-60, { duration: 0 })
      ),
      -1, false
    );
    bikeY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 400 }),
        withTiming(6, { duration: 400 }),
        withTiming(-6, { duration: 400 }),
        withTiming(0, { duration: 400 }),
      ),
      -1, false
    );
    setTimeout(() => {
      textOpacity.value = withTiming(1, { duration: 600 });
    }, 400);
    sparkle1.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1, false
    );
    setTimeout(() => {
      sparkle2.value = withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
        -1, false
      );
    }, 350);
  }, []);

  const bikeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bikeX.value }, { translateY: bikeY.value }],
  }));
  const sp1Style = useAnimatedStyle(() => ({ opacity: sparkle1.value, transform: [{ scale: 0.8 + sparkle1.value * 0.4 }] }));
  const sp2Style = useAnimatedStyle(() => ({ opacity: sparkle2.value, transform: [{ scale: 0.8 + sparkle2.value * 0.4 }] }));
  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value, transform: [{ translateY: interpolate(textOpacity.value, [0, 1], [20, 0]) }] }));

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
      <LinearGradient
        colors={['#0F172A', '#1a2744', '#0F172A']}
        style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Sparkles */}
        <Animated.Text style={[{ position: 'absolute', top: '30%', left: '20%', fontSize: 28 }, sp1Style]}>✨</Animated.Text>
        <Animated.Text style={[{ position: 'absolute', top: '28%', right: '22%', fontSize: 22 }, sp2Style]}>⭐</Animated.Text>
        <Animated.Text style={[{ position: 'absolute', top: '38%', left: '35%', fontSize: 18 }, sp1Style]}>✨</Animated.Text>
        <Animated.Text style={[{ position: 'absolute', bottom: '32%', right: '18%', fontSize: 24 }, sp2Style]}>✨</Animated.Text>

        {/* Road */}
        <View style={{ width: '90%', height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {[...Array(8)].map((_, i) => (
              <View key={i} style={{ width: 24, height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
            ))}
          </View>
        </View>

        {/* Bike row */}
        <View style={{ width: '90%', height: 70, overflow: 'hidden', justifyContent: 'center' }}>
          <Animated.Text style={[{ fontSize: 48, position: 'absolute' }, bikeStyle]}>🚲</Animated.Text>
        </View>

        {/* Road 2 */}
        <View style={{ width: '90%', height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 20, marginBottom: 52 }} />

        {/* Text */}
        <Animated.View style={[{ alignItems: 'center', paddingHorizontal: 32 }, textStyle]}>
          <Text style={{ color: '#F8FAFC', fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
            נתראה בקרוב! 🛴🚲
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
            ההזמנה בוטלה בהצלחה
          </Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

export default function JobTrackingScreen() {
  const router = useRouter();
  // Slice 3: Accept both 'id' (preferred) and 'jobId' (from notifs, payment returns, legacy) for robustness.
  const rawParams = useLocalSearchParams<{ id?: string; jobId?: string }>();
  const params = { id: rawParams.id || rawParams.jobId || '' };
  const insets = useSafeAreaInsets();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const isRTL = language === 'he';

  const activeJob = useActiveJobStore((s) => s.activeJob);
  const technicianLocation = useActiveJobStore((s) => s.technicianLocation);
  const setTechnicianLocation = useActiveJobStore((s) => s.setTechnicianLocation);
  const updateJobStatus = useActiveJobStore((s) => s.updateJobStatus);
  const updateJobTimestamps = useActiveJobStore((s) => s.updateJobTimestamps);
  const updateJobFinalPrice = useActiveJobStore((s) => s.updateJobFinalPrice);
  const currentLocation = useLocationStore((s) => s.currentLocation);

  const initialEta = (activeJob?.technician as any)?.eta ?? 15;
  const [eta, setEta] = useState<number>(initialEta);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '' });

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<string>(() => (activeJob as any)?.payment_status ?? 'pending');
  const paymentStatusRef = useRef<string>((activeJob as any)?.payment_status ?? 'pending');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // C01 FIX: ref tracks live status so polling logic never reads stale closure
  const statusRef = useRef<JobStatus | undefined>(activeJob?.status);
  useEffect(() => {
    statusRef.current = activeJob?.status;
  }, [activeJob?.status]);

  // C02 FIX: isMountedRef prevents state updates after unmount and stops any
  // in-flight poll from triggering navigation/state writes on an unmounted tree
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const pollJobStatus = useCallback(async () => {
    const liveStatus = statusRef.current;
    if (!params.id || !liveStatus || liveStatus === 'completed' || liveStatus === 'cancelled') return;
    try {
      const result = await api.get<{ job: any }>(`/api/jobs/${params.id}`);
      if (!isMountedRef.current || !result.job) return;

      const dbJob = result.job;
      const newStatus: JobStatus = dbJob.status;

      if (newStatus !== liveStatus) {
        if (newStatus === 'accepted' || newStatus === 'arrived') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        updateJobStatus(newStatus);
        updateJobTimestamps({
          accepted_at: dbJob.acceptedAt ?? undefined,
          on_way_at: dbJob.onWayAt ?? undefined,
          arrived_at: dbJob.arrivedAt ?? undefined,
          in_progress_at: dbJob.inProgressAt ?? undefined,
          completed_at: dbJob.completedAt ?? undefined,
        });
        if (newStatus === 'completed') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (dbJob.finalPrice !== undefined && dbJob.finalPrice !== null) {
            updateJobFinalPrice(dbJob.finalPrice);
          }
          if (isMountedRef.current) {
            router.replace({ pathname: '/job-complete', params: { id: params.id } });
          }
        }
      }

      // Update payment status
      const newPaymentStatus: string = dbJob.paymentStatus ?? 'pending';
      if (newPaymentStatus !== paymentStatusRef.current) {
        paymentStatusRef.current = newPaymentStatus;
        if (isMountedRef.current) {
          setPaymentStatus(newPaymentStatus);
          if (newPaymentStatus === 'paid') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      }

      if (dbJob.technician?.currentLocationLat && dbJob.technician?.currentLocationLng) {
        setTechnicianLocation({
          latitude: dbJob.technician.currentLocationLat,
          longitude: dbJob.technician.currentLocationLng,
        });
      }
    } catch (error) {
      console.error('Error polling job status:', error);
    }
  }, [params.id]);

  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'cancelled') return;
    pollJobStatus();
    const interval = setInterval(pollJobStatus, 3000);
    return () => clearInterval(interval);
  }, [activeJob?.status, pollJobStatus]);

  // Recalculate ETA whenever technician location changes
  useEffect(() => {
    const techLoc = technicianLocation ?? activeJob?.technician?.current_location;
    const custLoc = currentLocation ?? (activeJob?.customer_location as any);
    if (!techLoc || !custLoc) return;
    const dist = calcDistance(techLoc.latitude, techLoc.longitude, custLoc.latitude, custLoc.longitude);
    setEta(calcEta(dist));
  }, [technicianLocation, currentLocation]);

  const handleCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await dialPhoneNumber(activeJob?.technician?.phone);
    if (result === 'ok') return;
    const messages = {
      no_phone: {
        title: isRTL ? 'אין מספר טלפון' : 'No phone number',
        message: isRTL ? 'אין מספר טלפון זמין עבור הטכנאי' : 'No phone number available for this technician',
      },
      invalid: {
        title: isRTL ? 'מספר לא תקין' : 'Invalid number',
        message: isRTL ? 'מספר הטלפון אינו תקין' : 'The phone number is invalid',
      },
      failed: {
        title: isRTL ? 'שגיאה' : 'Error',
        message: isRTL ? 'לא ניתן לבצע את השיחה. נסה שוב או שלח הודעה.' : 'Unable to start the call. Try again or send a message.',
      },
    };
    const copy = messages[result];
    setInfoModal({ visible: true, title: copy.title, message: copy.message });
  };

  const handleChat = () => {
    if (!activeJob) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/chat',
      params: {
        jobId: activeJob.id,
        otherName: activeJob.technician?.name ?? 'טכנאי',
        otherAvatar: activeJob.technician?.avatar_url ?? '',
      },
    });
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const supportPhone = process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '972585858586';
    const url = `https://wa.me/${supportPhone}`;
    Linking.openURL(url).catch(() => {
      setInfoModal({ visible: true, title: isRTL ? 'שגיאה' : 'Error', message: isRTL ? 'לא ניתן לפתוח WhatsApp' : 'Could not open WhatsApp' });
    });
  };

  const handlePayNow = useCallback(async () => {
    if (!params.id) return;
    setPaymentLoading(true);
    try {
      const result = await api.post<{ paymentUrl?: string; alreadyPaid?: boolean; error?: string; amount?: number }>(
        '/api/payments/create',
        { jobId: params.id }
      );
      if (result.alreadyPaid) {
        paymentStatusRef.current = 'paid';
        setPaymentStatus('paid');
        return;
      }
      if (result.paymentUrl) {
        // Use the in-app payment page (WebView) instead of external browser for better UX
        router.push({
          pathname: '/payment',
          params: {
            jobId: params.id,
            paymentUrl: result.paymentUrl,
            amount: (result.amount || activeJob?.estimated_price_min || 0).toString(),
            description: 'תשלום עבור תיקון אופניים',
          },
        });
      } else {
        setInfoModal({ visible: true, title: 'שגיאה', message: result.error ?? 'לא ניתן לפתוח דף תשלום. אנא נסה שנית.' });
      }
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('GROW') || msg.includes('טרם הוגדרה') || msg.includes('not configured')) {
        setInfoModal({ visible: true, title: 'ספק תשלומים לא מוגדר', message: 'לא ניתן ליצור דף תשלום אמיתי (GROW לא מוגדר). השתמש בכפתור Simulate למטה לבדיקה.' });
      } else {
        setInfoModal({ visible: true, title: 'שגיאה', message: 'לא ניתן ליצור דף תשלום. אנא נסה שנית.' });
      }
    } finally {
      setPaymentLoading(false);
    }
  }, [params.id, activeJob, router]);

  const handleSimulatePay = async () => {
    if (!params.id) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setPaymentLoading(true);
    try {
      const res = await api.post<{ success?: boolean; error?: string }>(`/api/payments/simulate-paid/${params.id}`, {});
      if (res.success) {
        paymentStatusRef.current = 'paid';
        setPaymentStatus('paid');
        setInfoModal({ visible: true, title: 'DEV', message: 'תשלום סומלץ בהצלחה (לצורך בדיקה בלבד). הטכנאי אמור לקבל התראה.' });
      } else {
        setInfoModal({ visible: true, title: 'שגיאה', message: res.error || 'לא ניתן לסמלץ תשלום' });
      }
    } catch (e: any) {
      setInfoModal({ visible: true, title: 'שגיאה', message: e?.message || 'שגיאה בסימולציית תשלום' });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleConfirmArrival = async () => {
    if (!params.id) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsConfirming(true);
    try {
      await api.patch(`/api/jobs/${params.id}/status`, { status: 'in_progress' });
      updateJobStatus('in_progress');
      updateJobTimestamps({
        accepted_at: activeJob?.accepted_at,
        on_way_at: activeJob?.on_way_at,
        arrived_at: activeJob?.arrived_at,
        in_progress_at: new Date().toISOString(),
        completed_at: undefined,
      });
    } catch (error) {
      console.error('Error confirming arrival:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setCancelModal(true);
  };

  const confirmCancel = async () => {
    setCancelModal(false);
    setIsCancelling(true);
    try {
      if (params.id) await api.patch(`/api/jobs/${params.id}/status`, { status: 'cancelled' });
    } catch (error) {
      console.error('Error cancelling job:', error);
    }
    updateJobStatus('cancelled');
    setTimeout(() => {
      router.replace('/(customer)/(tabs)');
    }, 2200);
  };

  const getCurrentStepIndex = (): number => {
    if (!activeJob) return 0;
    const index = statusSteps.findIndex((s) => s.key === activeJob.status);
    return index >= 0 ? index : 0;
  };

  const getStatusLabel = (): string => {
    if (!activeJob) return '';
    const step = statusSteps.find((s) => s.key === activeJob.status);
    return step ? t(step.labelKey as keyof typeof t) : '';
  };

  // Fetch job from API if store is empty (e.g. after app restart)
  useEffect(() => {
    if (!activeJob && params.id) {
      api.get<{ job: any }>(`/api/jobs/${params.id}`).then((result) => {
        if (result.job && isMountedRef.current) {
          const dbJob = result.job;
          const mapped = {
            id: dbJob.id,
            job_number: dbJob.jobNumber,
            customer_id: dbJob.customerId,
            technician_id: dbJob.technicianId,
            status: dbJob.status,
            photo_url: dbJob.photoUrl ?? '',
            description: dbJob.description ?? '',
            bike_type: dbJob.bikeType,
            categories: dbJob.category?.split(', ').filter(Boolean) ?? [],
            estimated_price_min: dbJob.estimatedPriceMin ?? 0,
            estimated_price_max: dbJob.estimatedPriceMax ?? 0,
            customer_location: { latitude: dbJob.customerLocationLat, longitude: dbJob.customerLocationLng },
            created_at: dbJob.createdAt,
            technician: dbJob.technician ? {
              id: dbJob.technician.id, name: dbJob.technician.name,
              email: dbJob.technician.email ?? '', phone: dbJob.technician.phone ?? '',
              avatar_url: dbJob.technician.image ?? '', role: 'technician' as const,
              rating: dbJob.technician.rating ?? 0, total_reviews: dbJob.technician.totalReviews ?? 0,
              verification_status: 'verified' as const, vehicle_type: dbJob.technician.vehicleType ?? '',
              service_radius: 10, is_available: true, base_price: dbJob.technician.basePrice ?? 0,
              total_earnings: 0, current_location: undefined, created_at: '', updated_at: '',
            } : undefined,
          };
          const { setActiveJob } = useActiveJobStore.getState();
          setActiveJob(mapped as any);
        } else if (!result.job && isMountedRef.current) {
          router.replace('/(customer)/(tabs)');
        }
      }).catch(() => {
        if (isMountedRef.current) router.replace('/(customer)/(tabs)');
      });
    }
  }, [params.id]);

  if (!activeJob) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#94A3B8', fontSize: 16 }}>{t('loading')}</Text>
      </View>
    );
  }

  if (isCancelling) {
    return <CancellingScreen />;
  }

  // Show waiting screen while pending
  if (activeJob.status === 'pending') {
    return <WaitingScreen onCancel={handleCancel} />;
  }

  // Show payment screen when technician accepted but customer hasn't paid yet
  if (activeJob.status === 'accepted' && paymentStatus !== 'paid') {
    const enableDevSimulate = process.env.EXPO_PUBLIC_ENABLE_DEV_SIMULATE_PAY === 'true';
    return (
      <PaymentRequiredScreen
        technician={activeJob.technician}
        amount={activeJob.estimated_price_min}
        onPayNow={handlePayNow}
        onCancel={handleCancel}
        onSimulatePay={enableDevSimulate ? handleSimulatePay : undefined}
        paymentLoading={paymentLoading}
      />
    );
  }

  const techLocation = technicianLocation ?? activeJob.technician_location;
  const canCancel = paymentStatus !== 'paid' && ['accepted', 'on_way'].includes(activeJob.status);
  const currentIndex = getCurrentStepIndex();
  const showETA = eta > 0 && activeJob.status !== 'arrived' && activeJob.status !== 'in_progress';

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      {/* Map */}
      <View style={{ height: '58%' }}>
        {currentLocation && techLocation ? (
          <MapView
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: (currentLocation.latitude + techLocation.latitude) / 2,
              longitude: (currentLocation.longitude + techLocation.longitude) / 2,
              latitudeDelta: Math.abs(currentLocation.latitude - techLocation.latitude) * 2 + 0.01,
              longitudeDelta: Math.abs(currentLocation.longitude - techLocation.longitude) * 2 + 0.01,
            }}
            showsUserLocation
            showsCompass={false}
          >
            <Marker
              coordinate={{ latitude: techLocation.latitude, longitude: techLocation.longitude }}
            >
              <View style={styles.markerContainer}>
                <View style={styles.markerAvatar}>
                  {activeJob.technician?.avatar_url ? (
                    <Image
                      source={{ uri: activeJob.technician.avatar_url }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <View style={styles.markerFallback}>
                      <Wrench size={20} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={styles.markerTail} />
              </View>
            </Marker>

            <Polyline
              coordinates={[
                { latitude: techLocation.latitude, longitude: techLocation.longitude },
                { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
              ]}
              strokeColor="#3B82F6"
              strokeWidth={3}
              lineDashPattern={[8, 6]}
            />
          </MapView>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <MapPin size={40} color="#475569" />
            <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
              {isRTL ? 'ממתין לעדכון מיקום הטכנאי...' : 'Waiting for technician location...'}
            </Text>
          </View>
        )}

        {/* Top Status Badge */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.statusBadge, { top: insets.top + 12 }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.95)']}
            style={styles.statusBadgeInner}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PulseDot />
              <View>
                <Text style={styles.statusBadgeText}>{getStatusLabel()}</Text>
                {activeJob?.job_number && (
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 1 }}>
                    הזמנה #{activeJob.job_number}
                  </Text>
                )}
              </View>
            </View>
            {showETA && (
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.etaPill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Clock size={12} color="#fff" />
                <Text style={styles.etaText}>
                  {eta} {t('minutes')}
                </Text>
              </LinearGradient>
            )}
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Bottom Sheet */}
      <Animated.View
        entering={FadeInUp.duration(450).springify()}
        style={styles.bottomSheet}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Technician Card */}
        <View style={styles.techCard}>
          <View style={styles.techAvatarWrap}>
            {activeJob.technician?.avatar_url ? (
              <Image
                source={{ uri: activeJob.technician.avatar_url }}
                style={styles.techAvatar}
              />
            ) : (
              <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.techAvatar}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
                  {activeJob.technician?.name?.charAt(0) ?? '?'}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.onlineBadge} />
          </View>

          <View style={styles.techInfo}>
            <Text style={styles.techName}>{activeJob.technician?.name ?? '—'}</Text>
            <Text style={styles.techSub}>
              {activeJob.technician?.vehicle_type ?? (isRTL ? 'טכנאי מוסמך' : 'Certified Technician')}
            </Text>
          </View>

          <View style={styles.contactButtons}>
            <Pressable
              onPress={handleChat}
              style={({ pressed }) => [styles.contactBtn, styles.whatsappBtn, pressed && { opacity: 0.85 }]}
            >
              <MessageCircle size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={handleCall}
              style={({ pressed }) => [styles.contactBtn, styles.callBtn, pressed && { opacity: 0.85 }]}
            >
              <Phone size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Progress Timeline */}
        <View style={styles.timeline}>
          {statusSteps.slice(0, 4).map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isLast = index === 3;
            const timestamp = formatTime(activeJob[step.timestampField] as string | undefined);

            return (
              <View key={step.key} style={styles.timelineRow}>
                {/* Line connector */}
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.stepDot,
                      isCompleted && styles.stepDotCompleted,
                      isCurrent && styles.stepDotCurrent,
                    ]}
                  >
                    {isCompleted ? (
                      <Check size={13} color="#fff" strokeWidth={3} />
                    ) : (
                      <Text
                        style={[
                          styles.stepNum,
                          isCurrent && styles.stepNumCurrent,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.stepLine,
                        isCompleted && styles.stepLineCompleted,
                      ]}
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.stepLabel,
                    isCompleted && styles.stepLabelDone,
                    isCurrent && styles.stepLabelActive,
                  ]}
                >
                  {t(step.labelKey as keyof typeof t)}
                </Text>

                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>{isRTL ? 'עכשיו' : 'Now'}</Text>
                  </View>
                )}

                {(isCompleted || isCurrent) && timestamp && (
                  <View style={styles.timestampBadge}>
                    <Clock size={10} color={isCompleted ? '#22C55E' : '#3B82F6'} />
                    <Text style={[styles.timestampText, isCompleted && styles.timestampTextDone]}>{timestamp}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>


        {/* Bottom Actions */}
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
          {activeJob.status === 'arrived' ? (
            <Pressable
              onPress={handleConfirmArrival}
              disabled={isConfirming}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: '#16A34A', flex: 1, opacity: isConfirming || pressed ? 0.75 : 1 },
              ]}
            >
              <Check size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 6 }}>
                {isRTL ? 'אשר הגעת טכנאי' : 'Confirm Arrival'}
              </Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={handleContactSupport}
                style={({ pressed }) => [styles.actionBtn, styles.supportBtn, pressed && { opacity: 0.85 }]}
              >
                <MessageCircle size={18} color="#475569" />
                <Text style={styles.supportBtnText}>{t('contactSupport')}</Text>
              </Pressable>

              {canCancel && (
                <Pressable
                  onPress={handleCancel}
                  style={({ pressed }) => [styles.actionBtn, styles.cancelBtn, pressed && { opacity: 0.85 }]}
                >
                  <X size={18} color="#EF4444" />
                  <Text style={styles.cancelBtnText}>{t('cancelOrder')}</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </Animated.View>

      <ConfirmModal
        visible={cancelModal}
        title={t('cancelOrder')}
        message={isRTL ? 'האם אתה בטוח שברצונך לבטל את ההזמנה?' : 'Are you sure you want to cancel this order?'}
        confirmText={t('yes')}
        cancelText={t('no')}
        onConfirm={confirmCancel}
        onCancel={() => setCancelModal(false)}
        destructive
      />

      <ConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        confirmText={t('close')}
        cancelText={t('close')}
        onConfirm={() => setInfoModal((s) => ({ ...s, visible: false }))}
        onCancel={() => setInfoModal((s) => ({ ...s, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Map
  markerContainer: {
    alignItems: 'center',
  },
  markerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#1D4ED8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  markerFallback: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTail: {
    width: 10,
    height: 10,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
    marginTop: -5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  // Status badge
  statusBadge: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  statusBadgeInner: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  statusBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  etaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Bottom sheet
  bottomSheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },

  // Technician card
  techCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  techAvatarWrap: {
    position: 'relative',
  },
  techAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  techInfo: {
    flex: 1,
    marginHorizontal: 14,
  },
  techName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  techSub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '400',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  contactBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  callBtn: {
    backgroundColor: '#3B82F6',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 20,
  },

  // Timeline
  timeline: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 8,
    flex: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 32,
    marginRight: 14,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  stepDotCompleted: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  stepDotCurrent: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  stepNumCurrent: {
    color: '#fff',
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 26,
    backgroundColor: '#E2E8F0',
    marginVertical: 3,
    borderRadius: 1,
  },
  stepLineCompleted: {
    backgroundColor: '#22C55E',
  },
  stepLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400',
    marginTop: 6,
    flex: 1,
    lineHeight: 20,
  },
  stepLabelDone: {
    color: '#64748B',
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  currentBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  currentBadgeText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  supportBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  supportBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  cancelBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  timestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
    marginLeft: 6,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },
  timestampTextDone: {
    color: '#22C55E',
  },
});
