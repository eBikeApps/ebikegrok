import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  I18nManager,
  ActivityIndicator,
  Linking,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { RequireAuth } from '@/components/RequireAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Star, Clock, MapPin, Filter, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLanguageStore, useLocationStore, useRepairRequestStore, useActiveJobStore, useOrdersStore } from '@/lib/store';
import { playSystemSound } from '@/lib/system-sounds';
import { getAvailableTechnicians, TechnicianWithDistance } from '@/lib/api/technicians';
import { getEffectiveCustomerLocation } from '@/lib/customer-location';
import { TechnicianProfile, TechnicianSortOption, Job } from '@/lib/types';
import { api } from '@/lib/api/api';
import { fetchCustomerActiveJob } from '@/lib/active-job-sync';
import { useSession } from '@/lib/auth/use-session';
import { uploadJobPhoto } from '@/lib/upload-job-photo';
import { formatJobReference } from '@/lib/job-reference';
import { canMountGoogleMap, safeImageSource } from '@/lib/geo';
import { PhoneColumn } from '@/components/PhoneColumn';

function TechnicianSelectScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const currentLocation = useLocationStore((s) => s.currentLocation);
  const getRequest = useRepairRequestStore((s) => s.getRequest);
  const problemDescription = useRepairRequestStore((s) => s.problemDescription);
  const customerName = useRepairRequestStore((s) => s.customerName);
  const customerPhone = useRepairRequestStore((s) => s.customerPhone);
  const customerEmail = useRepairRequestStore((s) => s.customerEmail);
  const customerAddress = useRepairRequestStore((s) => s.customerAddress);
  const customerLocationLat = useRepairRequestStore((s) => s.customerLocationLat);
  const customerLocationLng = useRepairRequestStore((s) => s.customerLocationLng);
  const reset = useRepairRequestStore((s) => s.reset);
  const setActiveJob = useActiveJobStore((s) => s.setActiveJob);
  const addOrder = useOrdersStore((s) => s.addOrder);

  const [sortOption, setSortOption] = useState<TechnicianSortOption>('nearest');
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianWithDistance | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingDetails, setSendingDetails] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '', onConfirm: undefined as (() => void) | undefined });

  const { data: session } = useSession();

  const addressLocation =
    customerLocationLat != null && customerLocationLng != null
      ? { latitude: customerLocationLat, longitude: customerLocationLng }
      : null;

  const jobLocation = addressLocation ?? getEffectiveCustomerLocation(currentLocation);
  const jobLat = Number(jobLocation?.latitude);
  const jobLng = Number(jobLocation?.longitude);
  const hasValidJobLocation = Number.isFinite(jobLat) && Number.isFinite(jobLng);

  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  const sortOptions: { key: TechnicianSortOption; label: string }[] = [
    { key: 'nearest', label: t('nearest') },
    { key: 'highest_rated', label: t('highestRated') },
    { key: 'lowest_price', label: t('lowestPrice') },
  ];

  // Fetch available technicians from API
  const fetchTechnicians = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const loc = hasValidJobLocation
        ? { latitude: jobLat, longitude: jobLng }
        : getEffectiveCustomerLocation(currentLocation);
      const techs = await getAvailableTechnicians(loc);
      setTechnicians(Array.isArray(techs) ? techs : []);
    } catch (error) {
      console.error('Error loading technicians:', error);
      setTechnicians([]);
      setInfoModal({ visible: true, title: t('error'), message: t('networkError'), onConfirm: undefined });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasValidJobLocation, jobLat, jobLng, currentLocation, t]);

  useEffect(() => {
    if (session?.user) {
      fetchTechnicians();
    }
  }, [session?.user, fetchTechnicians]);

  const sortedTechnicians = useMemo(() => {
    const sorted = [...technicians];

    switch (sortOption) {
      case 'nearest':
        return sorted.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
      case 'highest_rated':
        return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      case 'lowest_price':
        return sorted.sort((a, b) => (a.base_price ?? 0) - (b.base_price ?? 0));
      default:
        return sorted;
    }
  }, [technicians, sortOption]);

  const mapTechnicians = useMemo(
    () =>
      sortedTechnicians.filter(
        (tech) =>
          tech.current_location &&
          Number.isFinite(tech.current_location.latitude) &&
          Number.isFinite(tech.current_location.longitude)
      ),
    [sortedTechnicians]
  );

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const handleSortChange = (option: TechnicianSortOption) => {
    Haptics.selectionAsync();
    setSortOption(option);
  };

  const handleSelectTechnician = (tech: TechnicianWithDistance) => {
    playSystemSound('click');
    setSelectedTechnician(tech);
    setShowConfirmModal(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedTechnician || !addressLocation) {
      setInfoModal({
        visible: true,
        title: t('error'),
        message:
          language === 'he'
            ? 'לא נמצא מיקום לכתובת. חזור לשלב הכתובת ונסה שוב.'
            : 'Address location missing. Go back and verify your address.',
        onConfirm: undefined,
      });
      return;
    }
    // C08 FIX: prevent double-tap from creating two jobs / two uploads
    if (bookingLoading) return;

    playSystemSound('success');

    const request = getRequest();
    if (!request) {
      setInfoModal({ visible: true, title: t('error'), message: t('somethingWentWrong'), onConfirm: undefined });
      return;
    }

    try {
      setBookingLoading(true);

      const customerId = session?.user?.id;
      if (!customerId) {
        setInfoModal({
          visible: true,
          title: t('error'),
          message:
            language === 'he'
              ? 'החיבור לחשבון אבד זמנית. נסה שוב בעוד רגע.'
              : 'Session temporarily unavailable. Please try again.',
          onConfirm: undefined,
        });
        return;
      }

      // Upload photo only when provided — failure is non-blocking (photo is optional)
      let photoUrl: string | null = null;
      if (request.photo_uri) {
        try {
          photoUrl = await uploadJobPhoto(request.photo_uri, customerId);
        } catch (err: any) {
          if (err?.message === 'PHOTO_TOO_LARGE') {
            console.warn('[Booking] Photo too large, continuing without photo');
          } else {
            console.warn('[Booking] Photo upload failed, continuing without photo:', err);
          }
        }
      }

      if (!request.categories.length) {
        setInfoModal({ visible: true, title: t('error'), message: t('somethingWentWrong'), onConfirm: undefined });
        return;
      }

      const result = await api.post<{ job: any }>('/api/jobs', {
        technicianId: selectedTechnician.id,
        ...(photoUrl ? { photoUrl } : {}),
        description: request.description,
        problemDescription: problemDescription?.trim() || undefined,
        bikeType: request.bike_type,
        categories: request.categories,
        customerLocationLat: addressLocation.latitude,
        customerLocationLng: addressLocation.longitude,
        customerAddress: customerAddress || undefined,
        customerName: customerName?.trim() || undefined,
        customerPhone: customerPhone?.trim() || undefined,
      });

      if (!result.job) {
        setInfoModal({ visible: true, title: t('error'), message: t('somethingWentWrong'), onConfirm: undefined });
        return;
      }

      const dbJob = result.job;

      // Map DB job to frontend Job type
      const newJob: Job = {
        id: dbJob.id,
        job_number: dbJob.jobNumber,
        job_reference: dbJob.jobReference,
        customer_id: dbJob.customerId,
        technician_id: dbJob.technicianId,
        status: dbJob.status,
        photo_url: dbJob.photoUrl,
        description: dbJob.description,
        bike_type: dbJob.bikeType,
        categories: dbJob.category?.split(', ').filter(Boolean) ?? [],
        estimated_price_min: dbJob.estimatedPriceMin,
        estimated_price_max: dbJob.estimatedPriceMax,
        customer_location: { latitude: dbJob.customerLocationLat, longitude: dbJob.customerLocationLng },
        technician_location: selectedTechnician.current_location,
        created_at: dbJob.createdAt,
        technician: selectedTechnician,
      };

      setActiveJob(newJob);
      addOrder(newJob);
      reset();

      setShowConfirmModal(false);
      router.replace({ pathname: '/job-tracking', params: { id: newJob.id } });
    } catch (error: any) {
      console.error('Error creating job:', error);
      if (error?.status === 409 || (error?.message && (error.message.includes('409') || error.message.includes('הזמנה פעילה') || error.message.includes('active order')))) {
        const activeJobId = error?.data?.activeJobId;
        const activeJobStatus = error?.data?.activeJobStatus as string | undefined;
        const statusMessage =
          activeJobStatus === 'pending'
            ? t('waitingForTechnician')
            : activeJobStatus === 'accepted'
              ? t('waitingForPayment')
              : language === 'he'
                ? 'יש לך הזמנה פעילה. מועבר למעקב.'
                : 'You already have an active order. Redirecting to tracking.';
        setInfoModal({
          visible: true,
          title: language === 'he' ? 'הזמנה פעילה קיימת' : 'Active Order Exists',
          message: statusMessage,
          onConfirm: async () => {
            if (activeJobId) {
              router.replace({ pathname: '/job-tracking', params: { id: activeJobId } });
              return;
            }
            try {
              const existing = await fetchCustomerActiveJob();
              if (existing?.id) {
                setActiveJob(existing);
                router.replace({ pathname: '/job-tracking', params: { id: existing.id } });
              } else {
                router.replace('/(customer)/(tabs)');
              }
            } catch {
              router.replace('/(customer)/(tabs)');
            }
          },
        });
      } else {
        const msg = error?.message || t('somethingWentWrong');
        setInfoModal({ visible: true, title: t('error'), message: msg, onConfirm: undefined });
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const handleViewProfile = (techId: string) => {
    Haptics.selectionAsync();
    router.push({ pathname: '/technician-profile', params: { id: techId } });
  };

  const handleSendDetailsToRepresentative = async () => {
    try {
      setSendingDetails(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const request = getRequest();
      if (!request) {
        setInfoModal({ visible: true, title: t('error'), message: t('somethingWentWrong'), onConfirm: undefined });
        return;
      }

      const bikeTypeHebrew = request.bike_type === 'electric' ? 'אופניים חשמליים' : 'קורקינט';
      const categoryTranslations: Record<string, string> = {
        'front_tire_puncture': 'פנצ\'ר בגלגל קדמי',
        'rear_tire_puncture': 'פנצ\'ר בגלגל אחורי',
        'tire_tube_replacement': 'החלפת צמיג+פנימית',
        'brake_issue': 'ברקסים לא עובדים',
        'starts_no_drive': 'נדלק ולא נוסע',
        'general_electrical': 'תקלת חשמל כללית',
        'general_service': 'טיפול כללי',
      };
      const categoryHebrew = request.categories
        .map((c) => categoryTranslations[c] ?? c)
        .join(', ');

      const messageLines = [
        '🚨 דיווח תקלה חדש',
        '',
        `👤 שם הלקוח: ${customerName || 'לא צוין'}`,
        `📱 טלפון: ${customerPhone || 'לא צוין'}`,
        `🔧 תיאור התקלה: ${request.description}`,
        '',
        'אנא חזור אליי בהקדם האפשרי',
        'תודה!',
      ];

      const message = encodeURIComponent(messageLines.join('\n'));
      const phone = process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '972585858586';
      const webUrl = `https://wa.me/${phone}?text=${message}`;
      await Linking.openURL(webUrl);

      playSystemSound('swoosh');
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      playSystemSound('error');
      setInfoModal({ visible: true, title: t('error'), message: language === 'he' ? 'לא הצלחנו לפתוח את וואטסאפ. אנא פנה ישירות לתמיכה.' : 'Could not open WhatsApp. Please contact support directly.', onConfirm: undefined });
    } finally {
      setSendingDetails(false);
    }
  };

  const repairRequest = getRequest();
  const jobTotal = repairRequest?.estimated_price_max ?? null;

  return (
    <SafeAreaView style={tsStyles.screen} edges={['top', 'bottom']}>
      {/* Glass header */}
      <PhoneColumn style={{ flex: 0 }}>
      <View style={tsStyles.headerWrap}>
        <View style={tsStyles.headerCard}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, tsStyles.androidGlass]} />
          )}
          <View style={[StyleSheet.absoluteFill, tsStyles.blueWash]} />
          <View style={tsStyles.headerInner}>
            <Pressable onPress={handleBack} style={tsStyles.backBtn} hitSlop={8}>
              <BackIcon size={22} color="#1E40AF" />
            </Pressable>
            <View style={tsStyles.titleBlock}>
              <Text style={tsStyles.kicker}>
                {language === 'he' ? 'בחירת טכנאי' : 'Choose technician'}
              </Text>
              <Text style={tsStyles.pageTitle}>{t('selectTechnician')}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <View style={tsStyles.headerBorder} pointerEvents="none" />
        </View>
      </View>
      </PhoneColumn>

      {jobTotal != null && (
        <PhoneColumn style={{ flex: 0 }}>
        <View style={tsStyles.totalPill}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, tsStyles.androidGlass]} />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(191,219,254,0.35)' }]} />
          <Text style={tsStyles.totalText}>
            {t('repairTotal')}: ₪{jobTotal}
          </Text>
          <View style={tsStyles.totalBorder} pointerEvents="none" />
        </View>
        </PhoneColumn>
      )}

      {/* Mini map in glass frame */}
      {hasValidJobLocation && canMountGoogleMap() && (
        <View style={tsStyles.mapFrame}>
          <MapView
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: jobLat,
              longitude: jobLng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            showsUserLocation
          >
            {mapTechnicians.map((tech) => (
              <Marker
                key={tech.id}
                coordinate={{
                  latitude: tech.current_location!.latitude,
                  longitude: tech.current_location!.longitude,
                }}
              >
                <View style={tsStyles.mapMarker}>
                  <Text style={{ fontSize: 12 }}>🔧</Text>
                </View>
              </Marker>
            ))}
          </MapView>
          <View style={tsStyles.mapBorder} pointerEvents="none" />
        </View>
      )}

      <PhoneColumn>
      {/* Glass filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tsStyles.chipsRow}
        style={tsStyles.chipsScroll}
      >
        {sortOptions.map((option) => {
          const active = sortOption === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => handleSortChange(option.key)}
              style={[tsStyles.chip, active && tsStyles.chipActive]}
            >
              <Filter size={14} color={active ? '#fff' : '#2563EB'} />
              <Text style={[tsStyles.chipText, active && tsStyles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Technicians List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTechnicians(true)}
            tintColor="#3B82F6"
          />
        }
      >
        {loading ? (
          <View style={tsStyles.centerState}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={tsStyles.muted}>{t('loading')}...</Text>
          </View>
        ) : sortedTechnicians.length === 0 ? (
          <View style={tsStyles.centerState}>
            <View style={tsStyles.emptyOrb}>
              <MapPin size={36} color="#3B82F6" />
            </View>
            <Text style={tsStyles.emptyTitle}>אין טכנאים זמינים</Text>
            <Text style={tsStyles.emptySub}>לא נמצאו טכנאים זמינים באזור שלך כרגע</Text>

            <Pressable
              onPress={handleSendDetailsToRepresentative}
              disabled={sendingDetails}
              style={({ pressed }) => [tsStyles.whatsappCta, pressed && { opacity: 0.9 }]}
            >
              <LinearGradient
                colors={[
                  'rgba(96,165,250,0.95)',
                  'rgba(37,99,235,0.98)',
                  'rgba(29,78,216,1)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {sendingDetails ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={tsStyles.whatsappRow}>
                  <MessageCircle size={20} color="#fff" />
                  <Text style={tsStyles.whatsappText}>צור קשר בוואטסאפ</Text>
                </View>
              )}
            </Pressable>
            <Text style={tsStyles.emptyHint}>נציג יצור איתך קשר בהקדם האפשרי</Text>
          </View>
        ) : (
          sortedTechnicians.map((tech, index) => (
            <Animated.View
              key={tech.id}
              entering={FadeInUp.delay(index * 80).duration(380)}
            >
              <Pressable
                onPress={() => handleViewProfile(tech.id)}
                style={({ pressed }) => [tsStyles.techCard, pressed && { opacity: 0.96 }]}
              >
                {Platform.OS === 'ios' ? (
                  <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, tsStyles.androidGlass]} />
                )}
                <View style={[StyleSheet.absoluteFill, tsStyles.blueWash]} />

                <View style={tsStyles.techCardInner}>
                  <View style={tsStyles.techRow}>
                    {safeImageSource(tech.avatar_url) ? (
                      <Image
                        source={safeImageSource(tech.avatar_url)}
                        style={tsStyles.avatar}
                      />
                    ) : (
                      <View style={tsStyles.avatarFallback}>
                        <Text style={tsStyles.avatarLetter}>
                          {(tech.name || '?').charAt(0)}
                        </Text>
                      </View>
                    )}

                    <View style={tsStyles.techInfo}>
                      <Text style={tsStyles.techName}>{tech.name || '—'}</Text>
                      <View style={tsStyles.metaRow}>
                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                        <Text style={tsStyles.metaText}>
                          {(tech.rating ?? 0).toFixed(1)} ({tech.total_reviews ?? 0} {t('reviews')})
                        </Text>
                      </View>
                      <View style={[tsStyles.metaRow, { marginTop: 6, gap: 14 }]}>
                        <View style={tsStyles.metaRow}>
                          <MapPin size={14} color="#64748B" />
                          <Text style={tsStyles.metaText}>
                            {(Number.isFinite(tech.distance) ? tech.distance : 0).toFixed(1)} {t('kmAway')}
                          </Text>
                        </View>
                        <View style={tsStyles.metaRow}>
                          <Clock size={14} color="#059669" />
                          <Text style={tsStyles.etaText}>
                            {t('arrivalTime')}: {Number.isFinite(tech.eta) ? tech.eta : '—'} {t('minutes')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleSelectTechnician(tech)}
                    style={({ pressed }) => [tsStyles.selectBtn, pressed && { opacity: 0.9 }]}
                  >
                    <LinearGradient
                      colors={[
                        'rgba(96,165,250,0.95)',
                        'rgba(37,99,235,0.98)',
                        'rgba(29,78,216,1)',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                      colors={['rgba(255,255,255,0.4)', 'transparent']}
                      style={tsStyles.selectSheen}
                    />
                    <Text style={tsStyles.selectBtnText}>{t('selectAndBook')}</Text>
                  </Pressable>
                </View>
                <View style={tsStyles.techCardBorder} pointerEvents="none" />
              </Pressable>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Confirmation sheet — glass style */}
      {showConfirmModal && selectedTechnician && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={confirmStyles.overlay}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowConfirmModal(false)}
          />
          <Animated.View entering={FadeInUp.duration(300)} style={confirmStyles.sheet}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={48} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, confirmStyles.androidGlass]} />
            )}
            <View style={[StyleSheet.absoluteFill, confirmStyles.blueWash]} />

            <View style={confirmStyles.sheetInner}>
              <View style={confirmStyles.handle} />

              <Text style={confirmStyles.kicker}>
                {language === 'he' ? 'סיכום בחירה' : 'Booking summary'}
              </Text>
              <Text style={confirmStyles.title}>{t('confirmBooking')}</Text>

              {/* Technician glass card */}
              <View style={confirmStyles.techCard}>
                {safeImageSource(selectedTechnician.avatar_url) ? (
                  <Image
                    source={safeImageSource(selectedTechnician.avatar_url)}
                    style={{ width: 56, height: 56, borderRadius: 28 }}
                  />
                ) : (
                  <View style={confirmStyles.avatarFallback}>
                    <Text style={confirmStyles.avatarLetter}>
                      {(selectedTechnician.name || '?').charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Text style={confirmStyles.techName} numberOfLines={1}>
                    {selectedTechnician.name || '—'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Star size={14} color="#F59E0B" fill="#F59E0B" />
                    <Text style={confirmStyles.ratingText}>
                      {(selectedTechnician.rating ?? 0).toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={confirmStyles.etaPill}>
                  <Clock size={14} color="#059669" />
                  <Text style={confirmStyles.etaText}>
                    {Number.isFinite(selectedTechnician.eta) ? selectedTechnician.eta : '—'}{' '}
                    {t('minutes')}
                  </Text>
                </View>
              </View>

              {/* Confirm CTA — glass blue */}
              <Pressable
                onPress={handleConfirmBooking}
                disabled={bookingLoading}
                style={[confirmStyles.primaryCta, bookingLoading && { opacity: 0.7 }]}
              >
                <LinearGradient
                  colors={[
                    'rgba(96,165,250,0.92)',
                    'rgba(37,99,235,0.96)',
                    'rgba(29,78,216,0.98)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.45)', 'transparent']}
                  style={confirmStyles.primarySheen}
                />
                {bookingLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={confirmStyles.primaryText}>{t('confirmBooking')}</Text>
                )}
                <View style={confirmStyles.primaryBorder} pointerEvents="none" />
              </Pressable>

              {/* Cancel — glass secondary */}
              <Pressable
                onPress={() => setShowConfirmModal(false)}
                style={confirmStyles.cancelBtn}
              >
                <Text style={confirmStyles.cancelText}>{t('cancel')}</Text>
              </Pressable>
            </View>

            <View style={confirmStyles.sheetBorder} pointerEvents="none" />
          </Animated.View>
        </Animated.View>
      )}
      <ConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        alertOnly={!infoModal.onConfirm}
        confirmText={infoModal.onConfirm ? t('confirm') : t('close')}
        cancelText={t('cancel')}
        onConfirm={() => {
          setInfoModal((s) => ({ ...s, visible: false }));
          infoModal.onConfirm?.();
        }}
        onCancel={() => setInfoModal((s) => ({ ...s, visible: false }))}
      />
    </PhoneColumn>
    </SafeAreaView>
  );
}

const tsStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EBF4FF',
  },
  androidGlass: {
    backgroundColor: 'rgba(239, 246, 255, 0.92)',
  },
  blueWash: {
    backgroundColor: 'rgba(191, 219, 254, 0.32)',
  },
  headerWrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  headerCard: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  titleBlock: {
    alignItems: 'center',
    flex: 1,
  },
  kicker: {
    color: 'rgba(37,99,235,0.7)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pageTitle: {
    color: '#1E3A8A',
    fontSize: 18,
    fontWeight: '800',
  },
  headerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  totalPill: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 12,
    alignItems: 'center',
  },
  totalText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  totalBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  mapFrame: {
    height: 160,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  mapBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.55)',
  },
  mapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  chipsRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.55)',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#fff',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  muted: {
    color: '#64748B',
    marginTop: 14,
    fontWeight: '600',
  },
  emptyOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(219,234,254,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  emptyTitle: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyHint: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
  whatsappCta: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whatsappText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  techCard: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  techCardInner: {
    padding: 16,
  },
  techCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(219,234,254,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.55)',
  },
  avatarLetter: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 22,
  },
  techInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  techName: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  etaText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  selectBtn: {
    marginTop: 16,
    borderRadius: 999,
    overflow: 'hidden',
    minHeight: 58,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  selectSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  selectBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.2,
  },
});

const confirmStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 50,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  androidGlass: {
    backgroundColor: 'rgba(239, 246, 255, 0.94)',
  },
  blueWash: {
    backgroundColor: 'rgba(191, 219, 254, 0.32)',
  },
  sheetInner: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.55)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  kicker: {
    color: 'rgba(37, 99, 235, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#1E3A8A',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  techCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.5)',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(219, 234, 254, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.6)',
  },
  avatarLetter: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 20,
  },
  techName: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 17,
  },
  ratingText: {
    color: '#64748B',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '600',
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(209, 250, 229, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  etaText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 12,
  },
  primaryCta: {
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  primarySheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  primaryBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(191, 219, 254, 0.7)',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 15,
  },
  sheetBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.45)',
    borderBottomWidth: 0,
  },
});

export default function TechnicianSelectRoute() {
  return (
    <RequireAuth>
      <TechnicianSelectScreen />
    </RequireAuth>
  );
}
