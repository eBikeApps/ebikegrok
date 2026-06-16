import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, I18nManager, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { FileText, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

import { useLanguageStore } from '@/lib/store';
import { Job, OrderTabOption, OrderFilterOption } from '@/lib/types';
import { cn } from '@/lib/cn';
import { authClient } from '@/lib/auth/auth-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

const statusConfig: Record<string, { color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  accepted: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Clock },
  on_way: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Clock },
  arrived: { color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Clock },
  in_progress: { color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Clock },
  completed: { color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  cancelled: { color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
};

function mapDbJobToOrder(dbJob: any): Job {
  return {
    id: dbJob.id,
    job_number: dbJob.jobNumber,
    customer_id: dbJob.customerId,
    technician_id: dbJob.technicianId,
    status: dbJob.status,
    photo_url: dbJob.photoUrl ?? '',
    description: dbJob.description ?? '',
    bike_type: dbJob.bikeType,
    categories: dbJob.categories ?? (dbJob.category ? [dbJob.category] : []),
    estimated_price_min: dbJob.estimatedPriceMin ?? 0,
    estimated_price_max: dbJob.estimatedPriceMax ?? 0,
    customer_location: { latitude: dbJob.customerLocationLat, longitude: dbJob.customerLocationLng },
    created_at: dbJob.createdAt,
    final_price: dbJob.finalPrice ?? undefined,
    payment_status: dbJob.paymentStatus,
    technician: dbJob.technician
      ? {
          id: dbJob.technician.id,
          name: dbJob.technician.name,
          email: dbJob.technician.email ?? '',
          phone: dbJob.technician.phone ?? '',
          avatar_url: dbJob.technician.image ?? '',
          role: 'technician' as const,
          rating: dbJob.technician.rating ?? 0,
          total_reviews: dbJob.technician.totalReviews ?? 0,
          verification_status: 'verified' as const,
          vehicle_type: dbJob.technician.vehicleType ?? '',
          service_radius: 10,
          is_available: true,
          base_price: dbJob.technician.basePrice ?? 0,
          total_earnings: 0,
          current_location: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : undefined,
  } as Job;
}

export default function OrdersScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);

  const [orders, setOrders] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderTabOption>('active');
  const [filterOption, setFilterOption] = useState<OrderFilterOption>('all');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const fetchOrders = async () => {
        setIsLoading(true);
        try {
          const result = await authClient.getSession();
          const token = (result as any)?.data?.session?.token;
          if (!token) return;
          const res = await fetch(`${BACKEND_URL}/api/jobs`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = await res.json();
          if (!cancelled && Array.isArray(data?.jobs)) {
            setOrders(data.jobs.map(mapDbJobToOrder));
          }
        } catch {
          // ignore network errors silently — empty list shown
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };
      fetchOrders();
      return () => { cancelled = true; };
    }, [])
  );

  const tabs: { key: OrderTabOption; label: string }[] = [
    { key: 'active', label: t('active') },
    { key: 'history', label: t('history') },
    { key: 'cancelled', label: t('cancelled') },
  ];

  const filters: { key: OrderFilterOption; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'last_week', label: t('lastWeek') },
    { key: 'last_month', label: t('lastMonth') },
  ];

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'active') {
      return !['completed', 'cancelled'].includes(order.status);
    } else if (activeTab === 'history') {
      return order.status === 'completed';
    } else {
      return order.status === 'cancelled';
    }
  }).filter((order) => {
    if (filterOption === 'all') return true;
    const orderDate = new Date(order.created_at);
    const now = new Date();
    if (filterOption === 'last_week') {
      return orderDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      return orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  });

  const handleTabPress = (tab: OrderTabOption) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  const handleFilterPress = (filter: OrderFilterOption) => {
    Haptics.selectionAsync();
    setFilterOption(filter);
  };

  const handleOrderPress = (order: Job) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (['pending', 'accepted', 'on_way', 'arrived', 'in_progress'].includes(order.status)) {
      router.push({ pathname: '/job-tracking', params: { id: order.id } });
    } else {
      router.push({ pathname: '/order-details', params: { id: order.id } });
    }
  };

  const getStatusLabel = (status: Job['status']): string => {
    const labels: Record<string, string> = {
      pending: t('statusPending'),
      accepted: t('statusAccepted'),
      on_way: t('statusOnWay'),
      arrived: t('statusArrived'),
      in_progress: t('statusInProgress'),
      completed: t('statusCompleted'),
      cancelled: t('statusCancelled'),
    };
    return labels[status] ?? status;
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      front_tire_puncture: t('frontTirePuncture'),
      rear_tire_puncture: t('rearTirePuncture'),
      tire_tube_replacement: t('tireTubeReplacement'),
      brake_issue: t('brakeIssue'),
      starts_no_drive: t('startsNoDrive'),
      general_electrical: t('generalElectrical'),
      general_service: t('generalService'),
    };
    return labels[category] ?? category;
  };

  const ChevronIcon = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">{t('orders')}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white px-4 py-3 border-b border-gray-100">
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => handleTabPress(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
            accessibilityLabel={tab.label}
            className={cn(
              'flex-1 py-2 items-center rounded-lg mx-1',
              activeTab === tab.key ? 'bg-blue-500' : 'bg-gray-100'
            )}
          >
            <Text
              className={cn(
                'font-semibold',
                activeTab === tab.key ? 'text-white' : 'text-gray-600'
              )}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-white px-4 py-3"
        contentContainerStyle={{ gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        {filters.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => handleFilterPress(filter.key)}
            className={cn(
              'px-4 py-2 rounded-full border',
              filterOption === filter.key
                ? 'bg-blue-50 border-blue-500'
                : 'bg-white border-gray-200'
            )}
          >
            <Text
              className={cn(
                'font-medium',
                filterOption === filter.key ? 'text-blue-600' : 'text-gray-600'
              )}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Orders List */}
      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 20 }}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-8">
            <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-5">
              {activeTab === 'history' ? (
                <CheckCircle size={44} color="#9CA3AF" />
              ) : activeTab === 'cancelled' ? (
                <XCircle size={44} color="#9CA3AF" />
              ) : (
                <FileText size={44} color="#9CA3AF" />
              )}
            </View>
            <Text className="text-gray-700 font-bold text-lg text-center mb-2">{t('noOrders')}</Text>
            <Text className="text-gray-400 text-sm text-center leading-5">
              {activeTab === 'active'
                ? (language === 'he' ? 'לחץ על כפתור התיקון בדף הבית כדי להזמין טכנאי' : 'Tap the repair button on the home screen to book a technician')
                : activeTab === 'history'
                ? (language === 'he' ? 'ההזמנות שהושלמו יופיעו כאן' : 'Completed orders will appear here')
                : (language === 'he' ? 'הזמנות שבוטלו יופיעו כאן' : 'Cancelled orders will appear here')}
            </Text>
          </View>
        ) : (
          filteredOrders.map((order, index) => {
            const config = statusConfig[order.status] ?? statusConfig.pending;
            const StatusIcon = config.icon;

            return (
              <Animated.View
                key={order.id}
                entering={FadeInUp.delay(index * 80).duration(350)}
              >
                <Pressable
                  onPress={() => handleOrderPress(order)}
                  accessibilityRole="button"
                  accessibilityLabel={`${getStatusLabel(order.status)} - ${order.categories?.map(getCategoryLabel).join(', ')}`}
                  className="bg-white rounded-2xl p-4 mb-3 shadow-sm shadow-black/5 active:opacity-90"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                      <View className={cn('px-3 py-1 rounded-full', config.bgColor)}>
                        <View className="flex-row items-center gap-1">
                          <StatusIcon size={14} color={config.color.replace('text-', '')} />
                          <Text className={cn('font-medium text-sm', config.color)}>
                            {getStatusLabel(order.status)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text className="text-gray-400 text-sm">
                      {format(new Date(order.created_at), 'dd/MM/yyyy', {
                        locale: language === 'he' ? he : undefined,
                      })}
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    {order.technician?.avatar_url ? (
                      <Image
                        source={{ uri: order.technician.avatar_url }}
                        style={{ width: 48, height: 48, borderRadius: 24 }}
                      />
                    ) : (
                      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 20 }}>🔧</Text>
                      </View>
                    )}
                    <View className="flex-1 mx-3">
                      <Text className="text-gray-900 font-semibold text-base">
                        {order.categories?.map((cat) => getCategoryLabel(cat)).join(', ') || order.description}
                      </Text>
                      {order.technician && (
                        <Text className="text-gray-500 text-sm mt-1">
                          {order.technician.name}
                        </Text>
                      )}
                    </View>
                    <View className="items-end">
                      {order.final_price ? (
                        <Text className="text-gray-900 font-bold text-lg">
                          ₪{order.final_price}
                        </Text>
                      ) : (
                        <Text className="text-gray-500 text-sm">
                          ₪{order.estimated_price_min}-{order.estimated_price_max}
                        </Text>
                      )}
                      <ChevronIcon size={20} color="#9CA3AF" />
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
