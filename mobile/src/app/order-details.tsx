import React from 'react';
import { View, Text, Pressable, ScrollView, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Star, MapPin, Calendar, Wrench, Bike } from 'lucide-react-native';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';

import { useLanguageStore, useOrdersStore } from '@/lib/store';
import { REPAIR_CATEGORIES } from '@/lib/types';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const orders = useOrdersStore((s) => s.orders);

  const order = orders.find((o) => o.id === id);

  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  const getCategoryLabel = (category: string): string => {
    const found = REPAIR_CATEGORIES.find((c) => c.key === category);
    if (!found) return category;
    return t(found.labelKey as Parameters<typeof t>[0]);
  };

  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center" edges={['top']}>
        <Text className="text-gray-500 text-lg">{language === 'he' ? 'ההזמנה לא נמצאה' : 'Order not found'}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-3 bg-blue-500 rounded-xl">
          <Text className="text-white font-semibold">{language === 'he' ? 'חזרה' : 'Go back'}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isCompleted = order.status === 'completed';
  const displayPrice = order.final_price ?? order.estimated_price_min;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 bg-white border-b border-gray-100">
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          className="w-10 h-10 items-center justify-center"
        >
          <BackIcon size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-gray-900 text-center">
          {language === 'he' ? 'פרטי הזמנה' : 'Order Details'}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>

        {/* Status Banner */}
        <Animated.View entering={FadeInUp.delay(0).duration(400)}>
          <View className={`rounded-2xl p-5 items-center ${isCompleted ? 'bg-green-50' : 'bg-red-50'}`}>
            {isCompleted
              ? <CheckCircle size={48} color="#16A34A" />
              : <XCircle size={48} color="#DC2626" />
            }
            <Text className={`text-xl font-bold mt-3 ${isCompleted ? 'text-green-700' : 'text-red-700'}`}>
              {isCompleted
                ? (language === 'he' ? 'התיקון הושלם' : 'Repair Completed')
                : (language === 'he' ? 'הזמנה בוטלה' : 'Order Cancelled')
              }
            </Text>
            {order.job_number && (
              <View className="bg-blue-100 rounded-full px-3 py-1 mt-2">
                <Text className="text-blue-600 text-xs font-bold">#{order.job_number}</Text>
              </View>
            )}
            {order.completed_at && (
              <Text className="text-gray-500 text-sm mt-1">
                {format(new Date(order.completed_at), 'dd/MM/yyyy HH:mm', { locale: language === 'he' ? he : undefined })}
              </Text>
            )}
            {order.cancelled_at && (
              <Text className="text-gray-500 text-sm mt-1">
                {format(new Date(order.cancelled_at), 'dd/MM/yyyy HH:mm', { locale: language === 'he' ? he : undefined })}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Price */}
        {isCompleted && (
          <Animated.View entering={FadeInUp.delay(80).duration(400)}>
            <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5">
              <Text className="text-gray-500 text-sm mb-1">{language === 'he' ? 'מחיר סופי' : 'Final Price'}</Text>
              <Text className="text-3xl font-bold text-gray-900">₪{displayPrice}</Text>
              {order.payment_status === 'paid' && (
                <Text className="text-gray-400 text-sm mt-1">
                  {language === 'he' ? 'שולם בכרטיס אשראי' : 'Paid by credit card'}
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* Technician */}
        {order.technician && (
          <Animated.View entering={FadeInUp.delay(120).duration(400)}>
            <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5">
              <Text className="text-gray-500 text-sm mb-3">{language === 'he' ? 'טכנאי' : 'Technician'}</Text>
              <View className="flex-row items-center">
                {order.technician.avatar_url ? (
                  <Image
                    source={{ uri: order.technician.avatar_url }}
                    style={{ width: 52, height: 52, borderRadius: 26 }}
                  />
                ) : (
                  <View className="w-13 h-13 rounded-full bg-blue-100 items-center justify-center">
                    <Text className="text-blue-600 font-bold text-lg">
                      {order.technician.name.charAt(0)}
                    </Text>
                  </View>
                )}
                <View className="flex-1 mx-3">
                  <Text className="text-gray-900 font-semibold text-base">{order.technician.name}</Text>
                  <View className="flex-row items-center mt-1">
                    <Star size={14} color="#F59E0B" fill="#F59E0B" />
                    <Text className="text-gray-600 text-sm mx-1">{order.technician.rating?.toFixed(1) ?? '—'}</Text>
                    <Text className="text-gray-400 text-sm">({order.technician.total_reviews ?? 0})</Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Repair Details */}
        <Animated.View entering={FadeInUp.delay(160).duration(400)}>
          <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5">
            <Text className="text-gray-500 text-sm mb-3">{language === 'he' ? 'פרטי תיקון' : 'Repair Details'}</Text>

            <View className="flex-row items-center mb-3">
              <Bike size={18} color="#6B7280" />
              <Text className="text-gray-700 font-medium mx-2">
                {order.bike_type === 'electric'
                  ? (language === 'he' ? 'אופניים חשמליים' : 'Electric Bike')
                  : (language === 'he' ? 'אופניים רגילים' : 'Regular Bike')
                }
              </Text>
            </View>

            <View className="flex-row items-start">
              <Wrench size={18} color="#6B7280" style={{ marginTop: 2 }} />
              <View className="flex-1 mx-2">
                {order.categories?.map((cat) => (
                  <Text key={cat} className="text-gray-700 font-medium mb-1">
                    {getCategoryLabel(cat)}
                  </Text>
                ))}
              </View>
            </View>

            {order.technician_notes && (
              <View className="mt-3 pt-3 border-t border-gray-100">
                <Text className="text-gray-500 text-sm mb-1">{language === 'he' ? 'הערות טכנאי' : 'Technician Notes'}</Text>
                <Text className="text-gray-700">{order.technician_notes}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Photo */}
        {order.photo_url && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5">
              <Text className="text-gray-500 text-sm mb-3">{language === 'he' ? 'תמונת התקלה' : 'Issue Photo'}</Text>
              <Image
                source={{ uri: order.photo_url }}
                style={{ width: '100%', height: 200, borderRadius: 12 }}
                contentFit="cover"
              />
            </View>
          </Animated.View>
        )}

        {/* Timeline */}
        <Animated.View entering={FadeInUp.delay(240).duration(400)}>
          <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5">
            <Text className="text-gray-500 text-sm mb-3">{language === 'he' ? 'ציר זמן' : 'Timeline'}</Text>
            <View className="flex-row items-center mb-2">
              <Calendar size={16} color="#6B7280" />
              <Text className="text-gray-500 text-sm mx-2">{language === 'he' ? 'נפתח' : 'Created'}</Text>
              <Text className="text-gray-700 text-sm font-medium">
                {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: language === 'he' ? he : undefined })}
              </Text>
            </View>
            {order.accepted_at && (
              <View className="flex-row items-center mb-2">
                <Calendar size={16} color="#6B7280" />
                <Text className="text-gray-500 text-sm mx-2">{language === 'he' ? 'התקבל' : 'Accepted'}</Text>
                <Text className="text-gray-700 text-sm font-medium">
                  {format(new Date(order.accepted_at), 'HH:mm')}
                </Text>
              </View>
            )}
            {order.in_progress_at && (
              <View className="flex-row items-center mb-2">
                <Calendar size={16} color="#6B7280" />
                <Text className="text-gray-500 text-sm mx-2">{language === 'he' ? 'התחיל' : 'Started'}</Text>
                <Text className="text-gray-700 text-sm font-medium">
                  {format(new Date(order.in_progress_at), 'HH:mm')}
                </Text>
              </View>
            )}
            {order.completed_at && (
              <View className="flex-row items-center">
                <Calendar size={16} color="#16A34A" />
                <Text className="text-green-600 text-sm mx-2">{language === 'he' ? 'הושלם' : 'Completed'}</Text>
                <Text className="text-green-700 text-sm font-medium">
                  {format(new Date(order.completed_at), 'HH:mm')}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Address */}
        {order.customer_location && (
          <Animated.View entering={FadeInUp.delay(280).duration(400)}>
            <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5">
              <View className="flex-row items-center">
                <MapPin size={18} color="#6B7280" />
                <Text className="text-gray-500 text-sm mx-2">{language === 'he' ? 'כתובת תיקון' : 'Repair Address'}</Text>
              </View>
              {order.customer_location.address && (
                <Text className="text-gray-700 font-medium mt-2">{order.customer_location.address}</Text>
              )}
            </View>
          </Animated.View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
