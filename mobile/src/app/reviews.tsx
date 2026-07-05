import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Star, MessageSquareText } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

import { useLanguageStore } from '@/lib/store';
import { Review } from '@/lib/types';
import { getTechnicianReviews } from '@/lib/api/reviews';

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color="#F59E0B"
          fill={star <= rating ? '#F59E0B' : 'transparent'}
        />
      ))}
    </View>
  );
}

function ratingBreakdown(reviews: Review[]) {
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => Math.round(r.rating) === stars).length;
    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
    return { stars, count, pct };
  });
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { technicianId, technicianName, rating: ratingParam } = useLocalSearchParams<{
    technicianId: string;
    technicianName?: string;
    rating?: string;
  }>();
  const language = useLanguageStore((s) => s.language);
  const isHe = language === 'he';

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const displayName = technicianName || (isHe ? 'הטכנאי' : 'Technician');
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : Number(ratingParam ?? 0);

  const loadReviews = useCallback(async (isRefresh = false) => {
    if (!technicianId) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await getTechnicianReviews(technicianId);
      setReviews(data);
    } catch {
      setError(isHe ? 'לא ניתן לטעון ביקורות' : 'Could not load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [technicianId, isHe]);

  useFocusEffect(
    useCallback(() => {
      loadReviews();
    }, [loadReviews])
  );

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <LinearGradient
        colors={['#ECFDF5', '#F0FDF4', '#F8FAFC']}
        style={{ paddingBottom: 8 }}
      >
        <SafeAreaView edges={['top']}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Pressable
              onPress={handleBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.9)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BackIcon size={22} color="#374151" />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
              {isHe ? 'ביקורות' : 'Reviews'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Summary */}
          <Animated.View
            entering={FadeInUp.duration(350)}
            style={{
              marginHorizontal: 16,
              marginTop: 4,
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: 20,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center' }}>
              {displayName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 8 }}>
              <Text style={{ fontSize: 42, fontWeight: '900', color: '#111827' }}>
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </Text>
              <View>
                <StarRow rating={Math.round(avgRating)} size={18} />
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                  {reviews.length} {isHe ? 'ביקורות' : 'reviews'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#6B7280', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
            {error}
          </Text>
          <Pressable
            onPress={() => loadReviews()}
            style={{ backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{isHe ? 'נסה שוב' : 'Retry'}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadReviews(true)}
              tintColor="#10B981"
            />
          }
        >
          {/* Breakdown */}
          {reviews.length > 0 && (
            <Animated.View
              entering={FadeInUp.delay(80).duration(350)}
              style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                padding: 16,
                shadowColor: '#000',
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 }}>
                {isHe ? 'פירוט דירוגים' : 'Rating breakdown'}
              </Text>
              {ratingBreakdown(reviews).map(({ stars, count, pct }) => (
                <View key={stars} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ width: 14, color: '#6B7280', fontWeight: '600' }}>{stars}</Text>
                  <Star size={13} color="#F59E0B" fill="#F59E0B" />
                  <View
                    style={{
                      flex: 1,
                      height: 8,
                      backgroundColor: '#F3F4F6',
                      borderRadius: 4,
                      marginHorizontal: 10,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: '#FBBF24',
                        borderRadius: 4,
                      }}
                    />
                  </View>
                  <Text style={{ width: 24, textAlign: 'right', color: '#9CA3AF', fontSize: 12 }}>{count}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* List */}
          {reviews.length === 0 ? (
            <Animated.View
              entering={FadeInUp.delay(120).duration(350)}
              style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                padding: 40,
                alignItems: 'center',
              }}
            >
              <MessageSquareText size={40} color="#D1D5DB" />
              <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: '#6B7280' }}>
                {isHe ? 'אין ביקורות עדיין' : 'No reviews yet'}
              </Text>
              <Text style={{ marginTop: 6, fontSize: 14, color: '#9CA3AF', textAlign: 'center' }}>
                {isHe
                  ? 'ביקורות מלקוחות יופיעו כאן לאחר השלמת תיקונים'
                  : 'Customer reviews will appear here after completed jobs'}
              </Text>
            </Animated.View>
          ) : (
            reviews.map((review, index) => {
              const customerName = review.customer?.name ?? (isHe ? 'לקוח' : 'Customer');
              const customerImage = review.customer?.image;
              const comment = review.comment ?? review.feedback;
              const dateStr = review.createdAt ?? review.created_at;
              const formattedDate = dateStr
                ? format(new Date(dateStr), 'dd MMM yyyy', {
                    locale: isHe ? he : undefined,
                  })
                : '';

              return (
                <Animated.View
                  key={review.id}
                  entering={FadeInUp.delay(100 + index * 40).duration(350)}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 20,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#ECFDF5',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {customerImage ? (
                        <Image source={{ uri: customerImage }} style={{ width: 44, height: 44 }} />
                      ) : (
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#10B981' }}>
                          {customerName.charAt(0)}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
                        {customerName}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formattedDate}</Text>
                    </View>
                    <StarRow rating={review.rating} />
                  </View>
                  {comment ? (
                    <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 22 }}>{comment}</Text>
                  ) : (
                    <Text style={{ fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' }}>
                      {isHe ? 'ללא תגובה' : 'No comment'}
                    </Text>
                  )}
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}