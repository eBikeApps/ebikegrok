import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
  StyleSheet,
  AppState,
} from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp,
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import {
  Phone,
  MessageCircle,
  Check,
  Plus,
  X,
  XCircle,
  ChevronLeft,
  Wrench,
  Clock,
  MapPin,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { useLanguageStore, useTechnicianStore } from '@/lib/store';
import { authClient } from '@/lib/auth/auth-client';
import { Job, JobStatus, JobPart } from '@/lib/types';
import { dialPhoneNumber } from '@/lib/phone';

// ─── Types ────────────────────────────────────────────────────────────────────

const statusSteps: { key: JobStatus; labelHe: string; icon: string }[] = [
  { key: 'on_way',      labelHe: 'בדרך ללקוח',       icon: '🚗' },
  { key: 'arrived',     labelHe: 'הגעתי',             icon: '📍' },
  { key: 'in_progress', labelHe: 'התיקון בתהליך',     icon: '🔧' },
  { key: 'completed',   labelHe: 'הושלם',             icon: '✅' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mapApiJob = (j: any): Job => ({
  id: j.id,
  job_number: j.jobNumber,
  customer_id: j.customerId,
  technician_id: j.technicianId,
  status: j.status,
  photo_url: j.photoUrl,
  description: j.description,
  bike_type: j.bikeType,
  categories: j.category?.split(', ').filter(Boolean) ?? [],
  estimated_price_min: j.estimatedPriceMin,
  estimated_price_max: j.estimatedPriceMax,
  customer_location: { latitude: j.customerLocationLat, longitude: j.customerLocationLng },
  technician_location: j.technicianLocationLat
    ? { latitude: j.technicianLocationLat, longitude: j.technicianLocationLng }
    : undefined,
  final_price: j.finalPrice ?? undefined,
  payment_status: j.paymentStatus ?? 'pending',
  created_at: j.createdAt,
  accepted_at: j.acceptedAt ?? undefined,
  on_way_at: j.onWayAt ?? undefined,
  arrived_at: j.arrivedAt ?? undefined,
  in_progress_at: j.inProgressAt ?? undefined,
  completed_at: j.completedAt ?? undefined,
  customer: j.customer
    ? {
        id: j.customer.id,
        name: j.customer.name,
        email: j.customer.email,
        phone: j.customer.phone,
        avatar_url: j.customer.image || '',
        role: 'customer' as const,
        saved_addresses: [],
        created_at: j.customer.createdAt,
        updated_at: j.customer.createdAt,
      }
    : undefined,
});

const getAuthToken = async (): Promise<string | null> => {
  try {
    const result = await authClient.getSession();
    return (result as any)?.data?.session?.token ?? null;
  } catch {
    return null;
  }
};

// ─── PulseDot ─────────────────────────────────────────────────────────────────

function PulseDot({ color = '#22C55E' }: { color?: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.5, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1, false
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 900 }), withTiming(0.5, { duration: 900 })),
      -1, false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: color },
          ringStyle,
        ]}
      />
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
    </View>
  );
}

// ─── CancelledScreen ──────────────────────────────────────────────────────────

function CancelledScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 350 });
    scale.value = withSpring(1, { damping: 14, stiffness: 120 });
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <LinearGradient
        colors={['#0F172A', '#1C1523', '#0F172A']}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
      >
        <Animated.View style={[iconStyle, { alignItems: 'center' }]}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: 'rgba(239,68,68,0.12)',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.25)',
          }}>
            <XCircle size={52} color="#EF4444" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ alignItems: 'center', marginTop: 28 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
            ההזמנה בוטלה
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 15, textAlign: 'center', lineHeight: 24 }}>
            הלקוח ביטל את ההזמנה.{'\n'}לא ניתן להמשיך בעבודה זו.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={{ marginTop: 48, width: '100%' }}
        >
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 18, paddingVertical: 18, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
                חזרה ללוח הבקרה
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

// ─── CompleteJobModal ─────────────────────────────────────────────────────────

function CompleteJobModal({
  job,
  onClose,
  onComplete,
  isPending,
}: {
  job: Job;
  onClose: () => void;
  onComplete: (args: { finalPrice: number; parts: JobPart[]; notes: string }) => void;
  isPending: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [finalPrice, setFinalPrice] = useState(String(job.estimated_price_min));
  const [parts, setParts] = useState<JobPart[]>([]);
  const [newPartName, setNewPartName] = useState('');
  const [newPartPrice, setNewPartPrice] = useState('');
  const [notes, setNotes] = useState('');

  const partsTotal = parts.reduce((sum, p) => sum + p.price, 0);
  const totalPrice = Number(finalPrice || 0) + partsTotal;

  const handleAdd = () => {
    if (!newPartName || !newPartPrice) return;
    Haptics.selectionAsync();
    setParts([...parts, { name: newPartName, price: Number(newPartPrice) }]);
    setNewPartName('');
    setNewPartPrice('');
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFillObject}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }} onPress={onClose} />
      <Animated.View entering={FadeInUp.duration(320).springify()} style={styles.completeSheet}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, paddingTop: 12 }}>
          {/* Title */}
          <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 24 }}>
            סיום עבודה
          </Text>

          {/* Price */}
          <Text style={styles.fieldLabel}>מחיר שירות</Text>
          <View style={styles.inputRow}>
            <Text style={{ color: '#64748B', fontSize: 20, marginLeft: 8 }}>₪</Text>
            <TextInput
              value={finalPrice}
              onChangeText={setFinalPrice}
              keyboardType="numeric"
              style={styles.priceInput}
              placeholderTextColor="#475569"
            />
          </View>

          {/* Parts */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>חלקים שהוחלפו</Text>
          {parts.map((p, i) => (
            <View key={i} style={styles.partRow}>
              <Text style={{ color: '#E2E8F0', flex: 1, fontSize: 14 }}>{p.name}</Text>
              <Text style={{ color: '#94A3B8', fontSize: 14, marginLeft: 8 }}>₪{p.price}</Text>
              <Pressable onPress={() => setParts(parts.filter((_, j) => j !== i))} style={{ marginLeft: 12, padding: 4 }}>
                <X size={15} color="#EF4444" />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              value={newPartName}
              onChangeText={setNewPartName}
              placeholder="שם חלק"
              placeholderTextColor="#475569"
              style={[styles.partInput, { flex: 1 }]}
            />
            <TextInput
              value={newPartPrice}
              onChangeText={setNewPartPrice}
              placeholder="₪"
              keyboardType="numeric"
              placeholderTextColor="#475569"
              style={[styles.partInput, { width: 72 }]}
            />
            <Pressable onPress={handleAdd} style={styles.addBtn}>
              <Plus size={18} color="#fff" />
            </Pressable>
          </View>

          {/* Total */}
          <View style={styles.totalBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>שירות</Text>
              <Text style={{ color: '#CBD5E1', fontSize: 13 }}>₪{finalPrice || 0}</Text>
            </View>
            {partsTotal > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: '#94A3B8', fontSize: 13 }}>חלקים</Text>
                <Text style={{ color: '#CBD5E1', fontSize: 13 }}>₪{partsTotal}</Text>
              </View>
            )}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#F8FAFC', fontSize: 17, fontWeight: '700' }}>סה״כ</Text>
              <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '800' }}>₪{totalPrice}</Text>
            </View>
          </View>

          {/* Submit */}
          <Pressable
            onPress={() => onComplete({ finalPrice: totalPrice, parts, notes })}
            disabled={isPending}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, marginTop: 8 }]}
          >
            <LinearGradient
              colors={isPending ? ['#374151', '#374151'] : ['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 16, paddingVertical: 17, alignItems: 'center' }}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>אשר סיום עבודה</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onClose} style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '500' }}>ביטול</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TechnicianActiveJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const language = useLanguageStore((s) => s.language);

  const updateActiveJob = useTechnicianStore((s) => s.updateActiveJob);
  const removeActiveJob = useTechnicianStore((s) => s.removeActiveJob);

  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [hasShownCancelAlert, setHasShownCancelAlert] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [issueNotFixedModal, setIssueNotFixedModal] = useState(false);
  const [jobCompleteModal, setJobCompleteModal] = useState<{ visible: boolean; finalPrice: number } | null>(null);
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '' });

  // Refetch immediately when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        jobQuery.refetch();
      }
    });
    return () => sub.remove();
  }, []);

  // ── Live polling ──────────────────────────────────────────────────────────

  const jobQuery = useQuery({
    queryKey: ['job', params.id],
    queryFn: async (): Promise<Job> => {
      const token = await getAuthToken();
      if (!token) throw new Error('No session token');
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs/${params.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const text = await res.text();
      if (!res.ok) throw new Error('Failed to load job');
      const data = text ? JSON.parse(text) : null;
      if (!data?.job) throw new Error('Job not found');
      return mapApiJob(data.job);
    },
    enabled: Boolean(params.id),
    refetchInterval: (query) => {
      const data = query.state.data as Job | undefined;
      if (data?.status === 'completed' || data?.status === 'cancelled') return false;
      return 800;
    },
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const job = jobQuery.data;

  // Sync local store
  useEffect(() => {
    if (job) {
      updateActiveJob(job.id, { status: job.status, final_price: job.final_price });
    }
  }, [job?.status, job?.id]);

  // Handle cancellation
  useEffect(() => {
    if (job?.status === 'cancelled' && !hasShownCancelAlert) {
      setHasShownCancelAlert(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      removeActiveJob(job.id);
      router.replace('/(technician)/(tabs)');
    }
  }, [job?.status, hasShownCancelAlert]);

  // ── Status mutation ───────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: async (payload: {
      status: JobStatus;
      finalPrice?: number;
      parts?: JobPart[];
      notes?: string;
      paymentMethod?: 'cash' | 'card';
    }) => {
      const token = await getAuthToken();
      if (!token) throw new Error('No session token');
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs/${params.id}/status`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
      if (!res.ok) {
        const msg = data?.message;
        if (msg?.includes('cancelled')) throw new Error('ההזמנה בוטלה ע״י הלקוח');
        throw new Error(msg || 'לא הצלחנו לעדכן את הסטטוס');
      }
      return data?.job ? mapApiJob(data.job) : null;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['job', params.id] });
      const previousJob = queryClient.getQueryData<Job>(['job', params.id]);
      if (previousJob) {
        queryClient.setQueryData<Job>(['job', params.id], { ...previousJob, status: payload.status });
        updateActiveJob(params.id, { status: payload.status });
      }
      return { previousJob };
    },
    onSuccess: (updated) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['job', params.id] });
      if (updated) updateActiveJob(updated.id, { status: updated.status, final_price: updated.final_price });
    },
    onError: (err: Error, _variables, context: any) => {
      if (context?.previousJob) {
        queryClient.setQueryData(['job', params.id], context.previousJob);
        updateActiveJob(params.id, { status: context.previousJob.status });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setInfoModal({ visible: true, title: 'שגיאה', message: err.message });
      queryClient.invalidateQueries({ queryKey: ['job', params.id] });
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getCurrentStepIndex = () => {
    if (!job) return -1;
    if (job.status === 'accepted') return -1;
    const idx = statusSteps.findIndex((s) => s.key === job.status);
    return idx;
  };

  const handleStatusUpdate = (nextStatus: JobStatus) => {
    if (!job) return;
    if (job.status === 'cancelled') { setInfoModal({ visible: true, title: 'שגיאה', message: 'ההזמנה בוטלה' }); return; }
    // T10/T18 FIX: enforce valid state transitions on the client so the UI
    // can never request a skip (e.g. on_way → in_progress, or accepted → completed).
    // The backend already validates this, but matching it here gives clearer UX
    // and removes a fraud vector where the button briefly enables an illegal step.
    const allowed: Record<JobStatus, JobStatus[]> = {
      pending:     ['accepted', 'cancelled'],
      accepted:    ['on_way', 'cancelled'],
      on_way:      ['arrived', 'cancelled'],
      arrived:     ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed:   [],
      cancelled:   [],
    };
    if (!allowed[job.status]?.includes(nextStatus)) {
      setInfoModal({ visible: true, title: 'שגיאה', message: `לא ניתן לעבור מ-${job.status} ל-${nextStatus}` });
      return;
    }
    // Slice 2: Extra client guard for the user spec (pay after accept before drive).
    // Even if button is hidden, direct calls or stale UI are blocked. Backend is final authority.
    if (nextStatus === 'on_way' && job.payment_status !== 'paid') {
      setInfoModal({ visible: true, title: 'ממתין לתשלום', message: 'הלקוח עדיין לא שילם. לא ניתן לצאת לדרך לפני אישור התשלום.' });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (nextStatus === 'completed') { setShowCompleteForm(true); return; }
    statusMutation.mutate({ status: nextStatus });
  };

  const handleCancelJob = () => {
    if (!job || job.status === 'cancelled' || job.status === 'completed') return;
    setCancelModal(true);
  };

  const confirmCancelJob = () => {
    setCancelModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    statusMutation.mutate({ status: 'cancelled' });
  };

  const handleCallCustomer = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await dialPhoneNumber(job?.customer?.phone);
    if (result === 'ok') return;
    const isHe = language === 'he';
    const messages = {
      no_phone: {
        title: isHe ? 'אין מספר טלפון' : 'No phone number',
        message: isHe ? 'אין מספר טלפון זמין עבור הלקוח' : 'No phone number available for this customer',
      },
      invalid: {
        title: isHe ? 'מספר לא תקין' : 'Invalid number',
        message: isHe ? 'מספר הטלפון אינו תקין' : 'The phone number is invalid',
      },
      failed: {
        title: isHe ? 'שגיאה' : 'Error',
        message: isHe ? 'לא ניתן לבצע את השיחה. נסה שוב או שלח הודעה.' : 'Unable to start the call. Try again or send a message.',
      },
    };
    const copy = messages[result];
    setInfoModal({ visible: true, title: copy.title, message: copy.message });
  };

  const handleIssueNotFixed = () => {
    if (!job || job.status === 'cancelled' || job.status === 'completed') return;
    if (job.payment_status !== 'paid') {
      setInfoModal({ visible: true, title: 'שגיאה', message: 'לא בוצע תשלום עבור הזמנה זו' });
      return;
    }
    setIssueNotFixedModal(true);
  };

  const confirmIssueNotFixed = async () => {
    if (!job) return;
    setIssueNotFixedModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('No session');
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/payments/refund/${job.id}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setInfoModal({ visible: true, title: 'שגיאה', message: (err as any)?.message ?? 'שגיאה בשליחת בקשת ההחזר' });
        return;
      }
      removeActiveJob(job.id);
      router.replace('/(technician)/(tabs)');
    } catch {
      setInfoModal({ visible: true, title: 'שגיאה', message: 'לא ניתן לשלוח את בקשת ההחזר. נסה שוב.' });
    }
  };

  const handleComplete = (args: { finalPrice: number; parts: JobPart[]; notes: string }) => {
    if (!job) return;
    statusMutation.mutate(
      { status: 'completed', ...args },
      {
        onSuccess: () => {
          setShowCompleteForm(false);
          updateActiveJob(job.id, {
            status: 'completed',
            final_price: args.finalPrice,
            parts: args.parts,
            technician_notes: args.notes,
            completed_at: new Date().toISOString(),
          });
          setJobCompleteModal({ visible: true, finalPrice: args.finalPrice });
        },
      }
    );
  };

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (jobQuery.isLoading || (!job && !jobQuery.isError)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ color: '#64748B', marginTop: 12, fontSize: 14 }}>טוען פרטי עבודה...</Text>
      </View>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#94A3B8', fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
          לא הצלחנו לטעון את ההזמנה
        </Text>
        <Pressable
          onPress={() => router.replace('/(technician)/(tabs)')}
          style={{ backgroundColor: '#1E293B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>חזרה ללוח הבקרה</Text>
        </Pressable>
      </View>
    );
  }

  // ── Cancelled ─────────────────────────────────────────────────────────────

  if (job.status === 'cancelled') {
    return (
      <CancelledScreen
        onBack={() => {
          removeActiveJob(job.id);
          router.replace('/(technician)/(tabs)');
        }}
      />
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  const currentIdx = getCurrentStepIndex();
  const nextStep = statusSteps[currentIdx + 1] ?? null;
  const isCompleted = job.status === 'completed';

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      {/* ── Map ── */}
      <View style={{ height: '50%' }}>
        <MapView
          style={{ flex: 1 }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: job.customer_location.latitude,
            longitude: job.customer_location.longitude,
            latitudeDelta: 0.014,
            longitudeDelta: 0.014,
          }}
          showsCompass={false}
        >
          <Marker coordinate={job.customer_location}>
            <View style={styles.mapMarker}>
              <Image
                source={{ uri: job.customer?.avatar_url || undefined }}
                style={{ width: 44, height: 44, borderRadius: 22 }}
              />
            </View>
          </Marker>
        </MapView>

        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { top: insets.top + 12 }]}
        >
          <ChevronLeft size={22} color="#F8FAFC" />
        </Pressable>

        {/* Status badge */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.statusBadge, { bottom: 24, left: 16, right: 16 }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.97)', 'rgba(248,250,252,0.95)']}
            style={styles.statusBadgeInner}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PulseDot color={isCompleted ? '#10B981' : '#3B82F6'} />
              <Text style={styles.statusText}>
                {isCompleted
                  ? 'הושלם'
                  : job.status === 'accepted'
                    ? (job.payment_status === 'paid' ? 'הזמנה אושרה ✓ — ניתן לצאת' : 'הזמנה אושרה ✓ — ממתין לתשלום')
                    : statusSteps.find((s) => s.key === job.status)?.labelHe ?? job.status}
              </Text>
            </View>
            <View style={[styles.jobIdBadge, { backgroundColor: isCompleted ? '#DCFCE7' : '#EFF6FF' }]}>
              <Text style={[styles.jobIdText, { color: isCompleted ? '#16A34A' : '#3B82F6' }]}>
                #{job.id.slice(-4)}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      {/* ── Bottom Sheet ── */}
      <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.sheet}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 12 }} />

        {/* Customer Card */}
        <View style={styles.customerCard}>
          <View style={styles.avatarWrap}>
            {job.customer?.avatar_url ? (
              <Image source={{ uri: job.customer.avatar_url }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#1D4ED8', '#1E40AF']} style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
                  {job.customer?.name?.charAt(0) ?? 'L'}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.customerInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.customerName}>{job.customer?.name ?? 'לקוח'}</Text>
              {job.job_number && (
                <View style={{ backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: '#60A5FA', fontSize: 11, fontWeight: '700' }}>#{job.job_number}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <MapPin size={11} color="#64748B" />
              <Text style={styles.customerAddr} numberOfLines={1}>
                {(job.customer_location as any).address ?? 'מיקום הלקוח'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.push({
                pathname: '/chat',
                params: {
                  jobId: job.id,
                  otherName: job.customer?.name ?? 'לקוח',
                  otherAvatar: job.customer?.avatar_url ?? '',
                },
              })}
              style={styles.contactBtn}
            >
              <LinearGradient colors={['#25D366', '#1DAA54']} style={styles.contactBtnInner}>
                <MessageCircle size={18} color="#fff" />
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={handleCallCustomer}
              style={styles.contactBtn}
            >
              <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.contactBtnInner}>
                <Phone size={18} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20 }} />

        {/* Progress Timeline */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Job info chip */}
          <View style={styles.jobInfoChip}>
            <Wrench size={13} color="#94A3B8" />
            <Text style={styles.jobInfoText} numberOfLines={1}>
              {job.bike_type === 'electric' ? '⚡ חשמלי' : '🚲 רגיל'} · {job.description}
            </Text>
            <View style={styles.priceChip}>
              <Text style={styles.priceChipText}>₪{job.estimated_price_min}–{job.estimated_price_max}</Text>
            </View>
          </View>

          {/* Customer photo */}
          {job.photo_url ? (
            <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.photoCard}>
              <Text style={styles.photoLabel}>תמונה מהלקוח</Text>
              <Image
                source={{ uri: job.photo_url }}
                style={styles.photoImage}
                contentFit="cover"
              />
            </Animated.View>
          ) : null}

          {/* Steps */}
          <View style={{ marginTop: 16 }}>
            {statusSteps.map((step, index) => {
              const isStepCompleted = index < currentIdx;
              const isStepCurrent = index === currentIdx;
              const isStepNext = index === currentIdx + 1;
              const isLast = index === statusSteps.length - 1;

              return (
                <View key={step.key} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  {/* Left column */}
                  <View style={{ alignItems: 'center', width: 34, marginRight: 14 }}>
                    <View style={[
                      styles.stepDot,
                      isStepCompleted && styles.stepDotDone,
                      isStepCurrent && styles.stepDotActive,
                    ]}>
                      {isStepCompleted ? (
                        <Check size={14} color="#fff" strokeWidth={2.5} />
                      ) : (
                        <Text style={[
                          styles.stepNum,
                          isStepCurrent && { color: '#fff' },
                        ]}>{index + 1}</Text>
                      )}
                    </View>
                    {!isLast && (
                      <View style={[
                        styles.stepLine,
                        isStepCompleted && styles.stepLineDone,
                        isStepCurrent && styles.stepLineActive,
                      ]} />
                    )}
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1, paddingBottom: isLast ? 0 : 24, paddingTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15 }}>{step.icon}</Text>
                      <Text style={[
                        styles.stepLabel,
                        isStepCompleted && styles.stepLabelDone,
                        isStepCurrent && styles.stepLabelActive,
                      ]}>
                        {step.labelHe}
                      </Text>
                      {isStepCurrent && (
                        <View style={styles.nowBadge}>
                          <Text style={styles.nowBadgeText}>עכשיו</Text>
                        </View>
                      )}
                    </View>

                    {/* "Update" button on the NEXT step */}
                    {isStepNext && !isCompleted && (
                      <Pressable
                        onPress={() => handleStatusUpdate(step.key)}
                        disabled={statusMutation.isPending}
                        style={({ pressed }) => [{ marginTop: 10, opacity: pressed ? 0.88 : 1 }]}
                      >
                        <LinearGradient
                          colors={statusMutation.isPending ? ['#1E293B', '#1E293B'] : ['#3B82F6', '#2563EB']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ borderRadius: 14, paddingVertical: 13, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                          {statusMutation.isPending ? (
                            <ActivityIndicator size="small" color="#94A3B8" />
                          ) : (
                            <>
                              <Text style={{ fontSize: 14 }}>{step.icon}</Text>
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                                {step.labelHe}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </Pressable>
                    )}

                    {/* "Complete" CTA on in_progress */}
                    {isStepCurrent && step.key === 'in_progress' && !isCompleted && (
                      <Pressable
                        onPress={() => setShowCompleteForm(true)}
                        style={({ pressed }) => [{ marginTop: 10, opacity: pressed ? 0.88 : 1 }]}
                      >
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ borderRadius: 14, paddingVertical: 13, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                          <Check size={18} color="#fff" strokeWidth={2.5} />
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                            סיים עבודה
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Slice 2: Prominent "waiting for customer payment" state (user spec: pay after accept, before drive).
              Tech must see clearly they cannot leave yet. Button is hidden/disabled until paid.
              Banner + status text + guard in handleStatusUpdate + backend 402/409. */}
          {job.status === 'accepted' && job.payment_status !== 'paid' && (
            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#F59E0B' }}>
              <Text style={{ color: '#92400E', fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
                ⏳ ממתין לתשלום הלקוח
              </Text>
              <Text style={{ color: '#92400E', fontSize: 14, textAlign: 'center', marginTop: 6 }}>
                הלקוח קיבל התראה לשלם. לא ניתן לצאת לדרך עד אישור התשלום.
              </Text>
              <Pressable
                onPress={() => jobQuery.refetch()}
                style={{ marginTop: 10, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 10 }}
              >
                <Text style={{ color: '#92400E', fontWeight: '600' }}>רענן סטטוס תשלום</Text>
              </Pressable>
            </View>
          )}

          {/* Accepted but not on_way yet — show first "Update" ONLY if paid (Slice 2) */}
          {job.status === 'accepted' && job.payment_status === 'paid' && (
            <Pressable
              onPress={() => handleStatusUpdate('on_way')}
              disabled={statusMutation.isPending}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient
                colors={statusMutation.isPending ? ['#1E293B', '#1E293B'] : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 }}
              >
                {statusMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={{ fontSize: 16 }}>🚗</Text>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>יצאתי — בדרך ללקוח</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}

          {isCompleted && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.completedBanner}>
              <Text style={{ fontSize: 32 }}>🎉</Text>
              <View>
                <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 16 }}>עבודה הושלמה!</Text>
                {job.final_price && (
                  <Text style={{ color: '#10B981', fontSize: 14, marginTop: 2 }}>₪{job.final_price} התקבל</Text>
                )}
              </View>
            </Animated.View>
          )}

          {!isCompleted && (
            <View style={{ marginTop: 24, gap: 10 }}>
              {job?.payment_status === 'paid' && ['in_progress', 'arrived'].includes(job?.status ?? '') && (
                <Pressable
                  onPress={handleIssueNotFixed}
                  disabled={statusMutation.isPending}
                  style={({ pressed }) => [{
                    opacity: pressed ? 0.7 : 1,
                    alignSelf: 'center',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    backgroundColor: '#FEF2F2',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#FECACA',
                  }]}
                >
                  <XCircle size={16} color="#DC2626" />
                  <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: '700' }}>תקלה לא תוקנה — החזר כסף</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleCancelJob}
                disabled={statusMutation.isPending}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16 }]}
              >
                <XCircle size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>ביטול ההזמנה</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ── Complete Modal ── */}
      {showCompleteForm && job && (
        <CompleteJobModal
          job={job}
          onClose={() => setShowCompleteForm(false)}
          onComplete={handleComplete}
          isPending={statusMutation.isPending}
        />
      )}

      <ConfirmModal
        visible={cancelModal}
        title="ביטול הזמנה"
        message="האם אתה בטוח שברצונך לבטל את ההזמנה? הלקוח יקבל התראה."
        confirmText="כן, בטל"
        cancelText="לא"
        onConfirm={confirmCancelJob}
        onCancel={() => setCancelModal(false)}
        destructive
      />

      <ConfirmModal
        visible={issueNotFixedModal}
        title="תקלה לא תוקנה"
        message="האם אתה מאשר שהתקלה לא תוקנה? הלקוח יקבל החזר כספי מלא."
        confirmText="כן, שלח החזר"
        cancelText="ביטול"
        onConfirm={confirmIssueNotFixed}
        onCancel={() => setIssueNotFixedModal(false)}
        destructive
      />

      <ConfirmModal
        visible={!!jobCompleteModal?.visible}
        title="העבודה הושלמה! 🎉"
        message={`התשלום של ₪${jobCompleteModal?.finalPrice ?? 0} התקבל בהצלחה`}
        confirmText="סיום"
        cancelText="סיום"
        onConfirm={() => {
          setJobCompleteModal(null);
          if (job) removeActiveJob(job.id);
          router.replace('/(technician)/(tabs)');
        }}
        onCancel={() => {
          setJobCompleteModal(null);
          if (job) removeActiveJob(job.id);
          router.replace('/(technician)/(tabs)');
        }}
      />

      <ConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        confirmText="סגור"
        cancelText="סגור"
        onConfirm={() => setInfoModal((s) => ({ ...s, visible: false }))}
        onCancel={() => setInfoModal((s) => ({ ...s, visible: false }))}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Map
  mapMarker: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 3, borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  backBtn: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  statusBadge: {
    position: 'absolute',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  statusBadgeInner: {
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  statusText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  jobIdBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  jobIdText: { fontSize: 12, fontWeight: '700' },

  // Sheet
  sheet: {
    flex: 1,
    backgroundColor: '#111827',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },

  // Customer card
  customerCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: '#111827',
  },
  customerInfo: { flex: 1, marginHorizontal: 14 },
  customerName: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  customerAddr: { color: '#64748B', fontSize: 12, flex: 1 },
  contactBtn: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  contactBtnInner: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },

  // Job info chip
  jobInfoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  jobInfoText: { color: '#94A3B8', fontSize: 13, flex: 1 },
  priceChip: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8,
  },
  priceChipText: { color: '#60A5FA', fontSize: 12, fontWeight: '700' },

  // Steps
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#334155',
  },
  stepDotDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  stepDotActive: {
    backgroundColor: '#2563EB', borderColor: '#2563EB',
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
  },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#475569' },
  stepLine: {
    width: 2, flex: 1, minHeight: 20, marginVertical: 4,
    backgroundColor: '#1E293B', borderRadius: 1,
  },
  stepLineDone: { backgroundColor: '#16A34A' },
  stepLineActive: { backgroundColor: '#2563EB' },
  stepLabel: { fontSize: 14, color: '#475569', fontWeight: '400' },
  stepLabelDone: { color: '#64748B', fontWeight: '500' },
  stepLabelActive: { color: '#F8FAFC', fontWeight: '700', fontSize: 15 },
  nowBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  nowBadgeText: { color: '#60A5FA', fontSize: 11, fontWeight: '700' },

  // Completed banner
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },

  // Complete modal
  completeSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#1A2235',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '85%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 16,
  },
  fieldLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F172A', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  priceInput: { flex: 1, color: '#F8FAFC', fontSize: 22, fontWeight: '700', paddingVertical: 12 },
  partRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F172A', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  partInput: {
    backgroundColor: '#0F172A', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    color: '#F8FAFC', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  addBtn: {
    width: 46, backgroundColor: '#2563EB', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  paymentBtnActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' },
  paymentBtnText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  paymentBtnTextActive: { color: '#60A5FA' },
  totalBox: {
    backgroundColor: '#0F172A', borderRadius: 16, padding: 16,
    marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },

  // Customer photo
  photoCard: {
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  photoLabel: {
    color: '#64748B', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  photoImage: {
    width: '100%', height: 200,
  },
});
