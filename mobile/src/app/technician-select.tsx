import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, I18nManager, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Star, Clock, MapPin, Filter, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

import { useLanguageStore, useLocationStore, useRepairRequestStore, useActiveJobStore, useOrdersStore } from '@/lib/store';
import { playSystemSound } from '@/lib/system-sounds';
import { getAvailableTechnicians, TechnicianWithDistance } from '@/lib/api/technicians';
import { TechnicianProfile, TechnicianSortOption, Job } from '@/lib/types';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';

export default function TechnicianSelectScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const currentLocation = useLocationStore((s) => s.currentLocation);
  const getRequest = useRepairRequestStore((s) => s.getRequest);
  const customerName = useRepairRequestStore((s) => s.customerName);
  const customerPhone = useRepairRequestStore((s) => s.customerPhone);
  const customerEmail = useRepairRequestStore((s) => s.customerEmail);
  const customerAddress = useRepairRequestStore((s) => s.customerAddress);
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
      const techs = await getAvailableTechnicians(currentLocation || undefined);
      setTechnicians(techs);
    } catch (error) {
      console.error('Error loading technicians:', error);
      setInfoModal({ visible: true, title: t('error'), message: t('networkError'), onConfirm: undefined });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentLocation, t]);

  useEffect(() => {
    if (session?.user) {
      fetchTechnicians();
    }
  }, [currentLocation, session?.user]);

  const sortedTechnicians = useMemo(() => {
    const sorted = [...technicians];

    switch (sortOption) {
      case 'nearest':
        return sorted.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      case 'highest_rated':
        return sorted.sort((a, b) => b.rating - a.rating);
      case 'lowest_price':
        return sorted.sort((a, b) => a.base_price - b.base_price);
      default:
        return sorted;
    }
  }, [technicians, sortOption]);

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

  const uploadPhoto = async (localUri: string): Promise<string | null> => {
    try {
      // Slice 4 / C06: quick size check before expensive base64 + upload (backend has 5MB cap + magic)
      const info = await FileSystem.getInfoAsync(localUri);
      const MAX_BYTES = 5 * 1024 * 1024;
      if (info.exists && (info.size ?? 0) > MAX_BYTES) {
        setInfoModal({ visible: true, title: t('error'), message: language === 'he' ? 'התמונה גדולה מדי (מקס 5MB)' : 'Photo too large (max 5MB)' , onConfirm: undefined });
        return null;
      }

      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
      });
      const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const result = await api.post<{ url: string }>('/api/uploads', { base64, mimeType });
      return result.url || null;
    } catch (err) {
      console.error('Photo upload error:', err);
      return null;
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedTechnician || !currentLocation) return;
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

      // Upload local photo to backend so technician can see it
      let photoUrl: string | null = null;
      if (request.photo_uri) {
        photoUrl = await uploadPhoto(request.photo_uri);
        if (!photoUrl) {
          setInfoModal({ visible: true, title: t('error'), message: language === 'he' ? 'העלאת התמונה נכשלה. ממשיך ללא תמונה.' : 'Photo upload failed. Continuing without photo.', onConfirm: undefined });
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
        bikeType: request.bike_type,
        category: request.categories.join(', '),
        estimatedPriceMin: request.estimated_price_min,
        estimatedPriceMax: request.estimated_price_max,
        customerLocationLat: currentLocation.latitude,
        customerLocationLng: currentLocation.longitude,
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
        setInfoModal({
          visible: true,
          title: language === 'he' ? 'הזמנה פעילה קיימת' : 'Active Order Exists',
          message: language === 'he' ? 'יש לך הזמנה פעילה. מועבר לדף התשלום שלה.' : 'You already have an active order. Redirecting to its payment page.',
          onConfirm: () => {
            if (activeJobId) {
              router.replace({ pathname: '/job-tracking', params: { id: activeJobId } });
            } else {
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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Pressable
          onPress={handleBack}
          className="w-10 h-10 items-center justify-center"
        >
          <BackIcon size={24} color="#374151" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">{t('selectTechnician')}</Text>
        <View className="w-10" />
      </View>

      {/* Mini Map */}
      {currentLocation && (
        <View className="h-48 bg-gray-200">
          <MapView
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            showsUserLocation
          >
            {sortedTechnicians.map((tech) => (
              <Marker
                key={tech.id}
                coordinate={{
                  latitude: tech.current_location!.latitude,
                  longitude: tech.current_location!.longitude,
                }}
              >
                <View className="w-8 h-8 bg-green-500 rounded-full items-center justify-center border-2 border-white">
                  <Text className="text-white text-xs font-bold">🔧</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
      )}

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-white px-4 py-3 border-b border-gray-100"
        contentContainerStyle={{ gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        {sortOptions.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => handleSortChange(option.key)}
            className={cn(
              'flex-row items-center px-4 py-2 rounded-full border',
              sortOption === option.key
                ? 'bg-blue-500 border-blue-500'
                : 'bg-white border-gray-200'
            )}
          >
            <Filter
              size={14}
              color={sortOption === option.key ? '#fff' : '#6B7280'}
            />
            <Text
              className={cn(
                'ml-2 font-medium',
                sortOption === option.key ? 'text-white' : 'text-gray-600'
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Technicians List */}
      <ScrollView
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTechnicians(true)}
            tintColor="#3B82F6"
          />
        }
      >
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-500 mt-4">{t('loading')}...</Text>
          </View>
        ) : sortedTechnicians.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
              <MapPin size={40} color="#9CA3AF" />
            </View>
            <Text className="text-gray-900 font-bold text-xl mb-2 text-center">אין טכנאים זמינים</Text>
            <Text className="text-gray-500 text-center mb-8">לא נמצאו טכנאים זמינים באזור שלך כרגע</Text>

            {/* Send Details to Representative Button */}
            <Pressable
              onPress={handleSendDetailsToRepresentative}
              disabled={sendingDetails}
              className="w-full max-w-sm"
            >
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24 }}
              >
                <View className="flex-row items-center justify-center">
                  {sendingDetails ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MessageCircle size={20} color="#fff" />
                      <Text className="text-white font-bold text-lg mr-2">צור קשר בוואטסאפ</Text>
                    </>
                  )}
                </View>
              </LinearGradient>
            </Pressable>

            <Text className="text-gray-400 text-sm text-center mt-4 px-6">
              נציג יצור איתך קשר בהקדם האפשרי
            </Text>
          </View>
        ) : (
          sortedTechnicians.map((tech, index) => (
          <Animated.View
            key={tech.id}
            entering={FadeInUp.delay(index * 100).duration(400)}
          >
            <Pressable
              onPress={() => handleViewProfile(tech.id)}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm shadow-black/5 active:opacity-95"
            >
              <View className="flex-row">
                {/* Avatar */}
                <Pressable onPress={() => handleViewProfile(tech.id)}>
                  <Image
                    source={{ uri: tech.avatar_url }}
                    style={{ width: 60, height: 60, borderRadius: 30 }}
                  />
                </Pressable>

                {/* Info */}
                <View className="flex-1 mx-3">
                  <Text className="text-gray-900 font-bold text-lg">{tech.name}</Text>

                  {/* Rating */}
                  <View className="flex-row items-center mt-1">
                    <Star size={14} color="#F59E0B" fill="#F59E0B" />
                    <Text className="text-gray-600 text-sm ml-1">
                      {tech.rating} ({tech.total_reviews} {t('reviews')})
                    </Text>
                  </View>

                  {/* Distance & ETA */}
                  <View className="flex-row items-center mt-2 gap-4">
                    <View className="flex-row items-center">
                      <MapPin size={14} color="#6B7280" />
                      <Text className="text-gray-500 text-sm ml-1">
                        {tech.distance.toFixed(1)} {t('kmAway')}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Clock size={14} color="#10B981" />
                      <Text className="text-green-600 text-sm ml-1 font-medium">
                        {tech.eta} {t('minutes')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Price */}
                <View className="items-end">
                  <Text className="text-gray-400 text-xs">{t('basePrice')}</Text>
                  <Text className="text-gray-900 font-bold text-lg">₪{tech.base_price}</Text>
                </View>
              </View>

              {/* Select Button */}
              <Pressable
                onPress={() => handleSelectTechnician(tech)}
                className="mt-4 bg-blue-500 rounded-xl py-3 items-center active:bg-blue-600"
              >
                <Text className="text-white font-bold">{t('selectAndBook')}</Text>
              </Pressable>
            </Pressable>
          </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedTechnician && (
        <Animated.View
          entering={FadeIn.duration(200)}
          className="absolute inset-0 bg-black/50 justify-end"
        >
          <Pressable
            className="flex-1"
            onPress={() => setShowConfirmModal(false)}
          />
          <Animated.View
            entering={FadeInUp.duration(300)}
            className="bg-white rounded-t-3xl p-6"
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />

            <Text className="text-xl font-bold text-gray-900 text-center mb-6">
              {t('confirmBooking')}
            </Text>

            <View className="flex-row items-center bg-gray-50 rounded-2xl p-4 mb-6">
              <Image
                source={{ uri: selectedTechnician.avatar_url }}
                style={{ width: 56, height: 56, borderRadius: 28 }}
              />
              <View className="flex-1 mx-3">
                <Text className="text-gray-900 font-bold text-lg">
                  {selectedTechnician.name}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text className="text-gray-600 text-sm ml-1">
                    {selectedTechnician.rating}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <View className="flex-row items-center">
                  <Clock size={16} color="#10B981" />
                  <Text className="text-green-600 font-bold ml-1">
                    {selectedTechnician.eta} {t('minutes')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Confirm Button */}
            <Pressable onPress={handleConfirmBooking} disabled={bookingLoading} className="mb-3">
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
              >
                {bookingLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-lg">
                    {t('confirmBooking')}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Cancel Button */}
            <Pressable
              onPress={() => setShowConfirmModal(false)}
              className="py-3 items-center"
            >
              <Text className="text-gray-500 font-medium">{t('cancel')}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
      <ConfirmModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        confirmText={infoModal.onConfirm ? t('confirm') : t('close')}
        cancelText={t('close')}
        onConfirm={() => {
          setInfoModal((s) => ({ ...s, visible: false }));
          infoModal.onConfirm?.();
        }}
        onCancel={() => setInfoModal((s) => ({ ...s, visible: false }))}
      />
    </SafeAreaView>
  );
}
