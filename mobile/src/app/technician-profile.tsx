import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, I18nManager, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { X, Star, MapPin, Wrench, Shield, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { useLanguageStore } from '@/lib/store';
import { TechnicianProfile, Review } from '@/lib/types';
import { cn } from '@/lib/cn';

export default function TechnicianProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);

  const [technician, setTechnician] = useState<TechnicianProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTechnicianData();
  }, [params.id]);

  const fetchTechnicianData = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
      const response = await fetch(`${backendUrl}/api/technicians/${params.id}`);
      if (response.ok) {
        const data = await response.json();

        // Transform backend data to frontend format
        const transformedTech: TechnicianProfile = {
          id: data.technician.id,
          name: data.technician.name,
          email: data.technician.email,
          phone: data.technician.phone || '',
          avatar_url: data.technician.image || '',
          role: 'technician',
          bio: data.technician.bio || '',
          rating: data.technician.rating || 0,
          total_reviews: data.technician.totalReviews || 0,
          verification_status: 'verified',
          vehicle_type: data.technician.vehicleType || '',
          service_radius: data.technician.serviceRadius || 0,
          is_available: data.technician.isAvailable || false,
          current_location: data.technician.currentLocationLat && data.technician.currentLocationLng ? {
            latitude: data.technician.currentLocationLat,
            longitude: data.technician.currentLocationLng,
          } : undefined,
          base_price: data.technician.basePrice || 0,
          total_earnings: data.technician.totalEarnings || 0,
          created_at: data.technician.createdAt,
          updated_at: data.technician.updatedAt,
        };

        setTechnician(transformedTech);

        // Fetch real reviews
        const reviewsRes = await fetch(`${backendUrl}/api/reviews/technician/${params.id}`);
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setReviews(reviewsData.reviews ?? []);
        }
      }
    } catch (error) {
      console.error('Error fetching technician:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const renderStars = (rating: number) => {
    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            color="#F59E0B"
            fill={star <= rating ? '#F59E0B' : 'transparent'}
          />
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <Pressable
            onPress={handleClose}
            className="w-10 h-10 items-center justify-center bg-gray-100 rounded-full"
          >
            <X size={24} color="#374151" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">
            {language === 'he' ? 'פרופיל טכנאי' : 'Technician Profile'}
          </Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!technician) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <Pressable
            onPress={handleClose}
            className="w-10 h-10 items-center justify-center bg-gray-100 rounded-full"
          >
            <X size={24} color="#374151" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">
            {language === 'he' ? 'פרופיל טכנאי' : 'Technician Profile'}
          </Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">{language === 'he' ? 'טכנאי לא נמצא' : 'Technician not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Pressable
          onPress={handleClose}
          className="w-10 h-10 items-center justify-center bg-gray-100 rounded-full"
        >
          <X size={24} color="#374151" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">
          {language === 'he' ? 'פרופיל טכנאי' : 'Technician Profile'}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile Header */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          className="items-center pt-6 pb-4"
        >
          <Image
            source={{ uri: technician.avatar_url }}
            style={{ width: 100, height: 100, borderRadius: 50 }}
          />

          <Text className="mt-4 text-2xl font-bold text-gray-900">
            {technician.name}
          </Text>

          {/* Verification Badge */}
          {technician.verification_status === 'verified' && (
            <View className="flex-row items-center mt-2 bg-green-100 px-3 py-1 rounded-full">
              <Shield size={14} color="#10B981" />
              <Text className="ml-1 text-green-700 font-medium text-sm">
                {t('verified')} ✓
              </Text>
            </View>
          )}

          {/* Rating Summary */}
          <View className="flex-row items-center mt-4">
            <Star size={24} color="#F59E0B" fill="#F59E0B" />
            <Text className="ml-2 text-2xl font-bold text-gray-900">
              {technician.rating}
            </Text>
            <Text className="ml-2 text-gray-500">
              ({technician.total_reviews} {t('reviews')})
            </Text>
          </View>
        </Animated.View>

        {/* Bio */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          className="mx-4 mt-4"
        >
          <Text className="text-gray-700 font-semibold mb-2">{t('bio')}</Text>
          <View className="bg-gray-50 rounded-2xl p-4">
            <Text className="text-gray-600 leading-6">{technician.bio}</Text>
          </View>
        </Animated.View>

        {/* Service Details */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="mx-4 mt-6"
        >
          <Text className="text-gray-700 font-semibold mb-2">{t('serviceDetails')}</Text>
          <View className="bg-gray-50 rounded-2xl p-4 gap-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center">
                <Wrench size={20} color="#3B82F6" />
              </View>
              <View className="ml-3">
                <Text className="text-gray-500 text-sm">{t('vehicleType')}</Text>
                <Text className="text-gray-900 font-medium">{technician.vehicle_type}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center">
                <MapPin size={20} color="#10B981" />
              </View>
              <View className="ml-3">
                <Text className="text-gray-500 text-sm">{t('serviceRadius')}</Text>
                <Text className="text-gray-900 font-medium">
                  {technician.service_radius} {language === 'he' ? 'ק״מ' : 'km'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center">
                <Text className="text-purple-600 font-bold">₪</Text>
              </View>
              <View className="ml-3">
                <Text className="text-gray-500 text-sm">{t('basePrice')}</Text>
                <Text className="text-gray-900 font-medium">₪{technician.base_price}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Rating Breakdown */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          className="mx-4 mt-6"
        >
          <Text className="text-gray-700 font-semibold mb-2">
            {language === 'he' ? 'פירוט דירוגים' : 'Rating Breakdown'}
          </Text>
          <View className="bg-gray-50 rounded-2xl p-4">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = reviews.filter((r) => Math.round(r.rating) === stars).length;
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;

              return (
                <View key={stars} className="flex-row items-center mb-2">
                  <Text className="text-gray-600 w-4">{stars}</Text>
                  <Star size={14} color="#F59E0B" fill="#F59E0B" className="mx-1" />
                  <View className="flex-1 h-2 bg-gray-200 rounded-full mx-3 overflow-hidden">
                    <View
                      className="h-full bg-yellow-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </View>
                  <Text className="text-gray-500 text-sm w-8">{count}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Recent Reviews */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          className="mx-4 mt-6"
        >
          <Text className="text-gray-700 font-semibold mb-2">
            {language === 'he' ? 'ביקורות אחרונות' : 'Recent Reviews'}
          </Text>
          <View className="gap-3">
            {reviews.slice(0, 3).map((review, index) => (
              <View key={review.id} className="bg-gray-50 rounded-2xl p-4">
                <View className="flex-row items-center justify-between mb-2">
                  {renderStars(review.rating)}
                  <Text className="text-gray-400 text-sm">
                    {new Date(review.createdAt ?? review.created_at ?? '').toLocaleDateString(
                      language === 'he' ? 'he-IL' : 'en-US'
                    )}
                  </Text>
                </View>
                {(review.comment ?? review.feedback) && (
                  <Text className="text-gray-600 leading-5">{review.comment ?? review.feedback}</Text>
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
