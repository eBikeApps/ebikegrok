import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, Linking, Platform, StyleSheet } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { RequireAuth } from '@/components/RequireAuth';
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
import { shouldSkipCompletionScreen } from '@/lib/completion-flow';
import {
  clearCustomerActiveJobState,
  resolveJobTrackingEntry,
} from '@/lib/active-job-sync';
import { formatJobReference } from '@/lib/job-reference';
import {
  statusSteps,
  calcDistance,
  calcEta,
  formatTime,
  PulseDot,
  WaitingScreen,
  PaymentRequiredScreen,
  CancellingScreen,
} from '@/components/job-tracking';


function JobTrackingScreen() {
  const router = useRouter();
  // Slice 3: Accept both 'id' (preferred) and 'jobId' (from notifs, payment returns, legacy) for robustness.
  const rawParams = useLocalSearchParams<{ id?: string; jobId?: string; paid?: string }>();
  const params = { id: rawParams.id || rawParams.jobId || '', paid: rawParams.paid };
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
  const deviceLocation = useLocationStore((s) => s.currentLocation);
  const jobCustomerLocation =
    activeJob?.customer_location?.latitude != null &&
    activeJob?.customer_location?.longitude != null
      ? {
          latitude: activeJob.customer_location.latitude,
          longitude: activeJob.customer_location.longitude,
        }
      : null;
  const mapCustomerLocation = jobCustomerLocation ?? deviceLocation;

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
  const completionNavigatedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    completionNavigatedRef.current = false;
    return () => {
      isMountedRef.current = false;
    };
  }, [params.id]);

  const [entryReady, setEntryReady] = useState(false);

  useEffect(() => {
    if (params.paid === '1') {
      paymentStatusRef.current = 'paid';
      setPaymentStatus('paid');
    }
  }, [params.paid]);

  const goHomeAfterCompletion = useCallback(() => {
    clearCustomerActiveJobState();
    if (isMountedRef.current) {
      router.replace('/(customer)/(tabs)');
    }
  }, [router]);

  const navigateToCompletionIfNeeded = useCallback(async (jobId: string) => {
    if (completionNavigatedRef.current) return;
    if (await shouldSkipCompletionScreen(jobId)) {
      completionNavigatedRef.current = true;
      goHomeAfterCompletion();
      return;
    }
    completionNavigatedRef.current = true;
    clearCustomerActiveJobState();
    if (isMountedRef.current) {
      router.replace({ pathname: '/job-complete', params: { id: jobId } });
    }
  }, [goHomeAfterCompletion, router]);

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
        statusRef.current = newStatus;
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
          await navigateToCompletionIfNeeded(params.id);
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
  }, [params.id, navigateToCompletionIfNeeded, updateJobStatus, updateJobTimestamps, updateJobFinalPrice, setTechnicianLocation]);

  // Resolve entry from server — prevents ghost orders after completion / app restart
  useEffect(() => {
    let cancelled = false;
    setEntryReady(false);

    (async () => {
      if (!params.id) {
        goHomeAfterCompletion();
        return;
      }
      const resolution = await resolveJobTrackingEntry(params.id);
      if (cancelled || !isMountedRef.current) return;

      if (resolution.action === 'home') {
        goHomeAfterCompletion();
        return;
      }
      if (resolution.action === 'complete') {
        completionNavigatedRef.current = true;
        clearCustomerActiveJobState();
        router.replace({ pathname: '/job-complete', params: { id: resolution.jobId } });
        return;
      }

      useActiveJobStore.getState().setActiveJob(resolution.job);
      statusRef.current = resolution.job.status;
      const pay = resolution.job.payment_status ?? 'pending';
      paymentStatusRef.current = pay;
      setPaymentStatus(pay);
      setEntryReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id, goHomeAfterCompletion, router]);

  useEffect(() => {
    if (!entryReady || !activeJob || !params.id) return;
    if (activeJob.status === 'completed') {
      navigateToCompletionIfNeeded(params.id);
      return;
    }
    if (activeJob.status === 'cancelled') {
      goHomeAfterCompletion();
      return;
    }
    pollJobStatus();
    const interval = setInterval(pollJobStatus, 2000);
    return () => clearInterval(interval);
  }, [entryReady, activeJob?.status, activeJob?.id, params.id, pollJobStatus, navigateToCompletionIfNeeded, goHomeAfterCompletion]);

  // Recalculate ETA whenever technician location changes
  useEffect(() => {
    const techLoc = technicianLocation ?? activeJob?.technician?.current_location;
    const custLoc = mapCustomerLocation;
    if (!techLoc || !custLoc) return;
    const dist = calcDistance(techLoc.latitude, techLoc.longitude, custLoc.latitude, custLoc.longitude);
    setEta(calcEta(dist));
  }, [technicianLocation, mapCustomerLocation?.latitude, mapCustomerLocation?.longitude]);

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
      const result = await api.post<{
        paymentUrl?: string;
        alreadyPaid?: boolean;
        error?: string;
        amount?: number;
        mockMode?: boolean;
        jobReference?: string;
        description?: string;
      }>(
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
            amount: (result.amount || activeJob?.estimated_price_max || activeJob?.estimated_price_min || 0).toString(),
            description:
              result.description ??
              (formatJobReference(activeJob?.job_number)
                ? `תשלום עבור ${formatJobReference(activeJob?.job_number)}`
                : 'תשלום עבור תיקון אופניים'),
          },
        });
      } else {
        setInfoModal({ visible: true, title: 'שגיאה', message: result.error ?? 'לא ניתן לפתוח דף תשלום. אנא נסה שנית.' });
      }
    } catch (e: any) {
      const status = e?.status;
      const msg = e?.message || '';
      if (status === 409) {
        const jobStatus = activeJob?.status;
        const conflictMessage =
          jobStatus === 'pending'
            ? t('waitingForTechnician')
            : jobStatus === 'accepted'
              ? t('waitingForPayment')
              : msg || (isRTL ? 'לא ניתן ליצור תשלום כרגע. נסה שוב.' : 'Cannot create payment right now. Try again.');
        setInfoModal({ visible: true, title: t('error'), message: conflictMessage });
        return;
      }
      const mockEnabled = process.env.EXPO_PUBLIC_MOCK_PAYMENTS === 'true';
      if (!mockEnabled && (msg.includes('טרם הוגדרה') || msg.includes('not configured'))) {
        setInfoModal({ visible: true, title: 'ספק תשלומים לא מוגדר', message: 'לא ניתן ליצור דף תשלום. הפעל MOCK_PAYMENTS בשרת לבדיקות.' });
      } else if (activeJob?.status === 'pending') {
        setInfoModal({ visible: true, title: t('error'), message: t('waitingForTechnician') });
      } else {
        setInfoModal({ visible: true, title: 'שגיאה', message: msg || 'לא ניתן ליצור דף תשלום. אנא נסה שנית.' });
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
    } catch (error: any) {
      console.error('Error confirming arrival:', error);
      setInfoModal({
        visible: true,
        title: t('error'),
        message: error?.message || (isRTL ? 'לא הצלחנו לאשר את ההגעה. נסה שוב.' : 'Could not confirm arrival. Please try again.'),
      });
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
      updateJobStatus('cancelled');
      clearCustomerActiveJobState();
      setTimeout(() => {
        router.replace('/(customer)/(tabs)');
      }, 2200);
    } catch (error) {
      console.error('Error cancelling job:', error);
      setIsCancelling(false);
      setInfoModal({
        visible: true,
        title: t('error'),
        message: isRTL ? 'לא הצלחנו לבטל את ההזמנה. נסה שוב.' : 'Could not cancel the order. Please try again.',
      });
    }
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

  const cancelModals = (
    <>
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
    </>
  );

  if (!entryReady || !activeJob) {
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
    return (
      <>
        <WaitingScreen onCancel={handleCancel} />
        {cancelModals}
      </>
    );
  }

  // Show payment screen when technician accepted but customer hasn't paid yet
  if (activeJob.status === 'accepted' && paymentStatus !== 'paid') {
    const mockPayments = process.env.EXPO_PUBLIC_MOCK_PAYMENTS === 'true';
    const enableDevSimulate =
      process.env.EXPO_PUBLIC_ENABLE_DEV_SIMULATE_PAY === 'true' && !mockPayments;
    return (
      <>
        <PaymentRequiredScreen
          technician={activeJob.technician}
          totalPrice={activeJob.estimated_price_max ?? activeJob.estimated_price_min ?? 0}
          onPayNow={handlePayNow}
          onCancel={handleCancel}
          onSimulatePay={enableDevSimulate ? handleSimulatePay : undefined}
          paymentLoading={paymentLoading}
        />
        {cancelModals}
      </>
    );
  }

  const techLocation = technicianLocation ?? activeJob.technician_location;
  const canCancel = paymentStatus !== 'paid';
  const currentIndex = getCurrentStepIndex();
  const showETA = eta > 0 && activeJob.status !== 'arrived' && activeJob.status !== 'in_progress';

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      {/* Map */}
      <View style={{ height: '58%' }}>
        {mapCustomerLocation && techLocation ? (
          <MapView
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: (mapCustomerLocation.latitude + techLocation.latitude) / 2,
              longitude: (mapCustomerLocation.longitude + techLocation.longitude) / 2,
              latitudeDelta: Math.abs(mapCustomerLocation.latitude - techLocation.latitude) * 2 + 0.01,
              longitudeDelta: Math.abs(mapCustomerLocation.longitude - techLocation.longitude) * 2 + 0.01,
            }}
            showsUserLocation={!!deviceLocation}
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

            <Marker coordinate={mapCustomerLocation}>
              <View style={[styles.markerContainer, { borderColor: '#10B981' }]}>
                <View style={[styles.markerFallback, { backgroundColor: '#10B981' }]}>
                  <MapPin size={20} color="#fff" />
                </View>
              </View>
            </Marker>

            <Polyline
              coordinates={[
                { latitude: techLocation.latitude, longitude: techLocation.longitude },
                { latitude: mapCustomerLocation.latitude, longitude: mapCustomerLocation.longitude },
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
                {!!formatJobReference(activeJob?.job_number) && (
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 1 }}>
                    {formatJobReference(activeJob?.job_number)}
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

      {cancelModals}
    </View>
  );
}

export default function JobTrackingRoute() {
  return (
    <RequireAuth>
      <JobTrackingScreen />
    </RequireAuth>
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
