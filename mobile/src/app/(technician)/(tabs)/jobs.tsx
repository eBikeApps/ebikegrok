import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Briefcase, Clock, CheckCircle, ChevronLeft, ChevronRight, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

import { useLanguageStore, useTechnicianStore } from '@/lib/store';
import { Job } from '@/lib/types';
import { cn } from '@/lib/cn';

type TabOption = 'active' | 'today' | 'week' | 'all';

export default function TechnicianJobsScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const activeJobs = useTechnicianStore((s) => s.activeJobs);

  const [activeTab, setActiveTab] = useState<TabOption>('active');

  const tabs: { key: TabOption; label: string }[] = [
    { key: 'active', label: language === 'he' ? 'פעילות' : 'Active' },
    { key: 'today', label: t('today') },
    { key: 'week', label: t('thisWeek') },
    { key: 'all', label: t('all') },
  ];

  const allJobs = [...activeJobs];

  const filteredJobs = allJobs.filter((job) => {
    const jobDate = new Date(job.created_at);
    const now = new Date();

    switch (activeTab) {
      case 'active':
        return !['completed', 'cancelled'].includes(job.status);
      case 'today':
        return jobDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return jobDate >= weekAgo;
      default:
        return true;
    }
  });

  const handleTabPress = (tab: TabOption) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  const handleJobPress = (job: Job) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (['accepted', 'on_way', 'arrived', 'in_progress'].includes(job.status)) {
      router.push({ pathname: '/(technician)/active-job', params: { id: job.id } });
    }
  };

  const getStatusBadge = (status: Job['status']) => {
    const config: Record<string, { label: string; color: string; bg: string }> = {
      pending: { label: language === 'he' ? 'ממתין' : 'Pending', color: 'text-yellow-600', bg: 'bg-yellow-100' },
      accepted: { label: language === 'he' ? 'התקבל' : 'Accepted', color: 'text-blue-600', bg: 'bg-blue-100' },
      on_way: { label: language === 'he' ? 'בדרך' : 'On the way', color: 'text-blue-600', bg: 'bg-blue-100' },
      arrived: { label: language === 'he' ? 'הגעתי' : 'Arrived', color: 'text-purple-600', bg: 'bg-purple-100' },
      in_progress: { label: language === 'he' ? 'בתהליך' : 'In progress', color: 'text-purple-600', bg: 'bg-purple-100' },
      completed: { label: language === 'he' ? 'הושלם' : 'Completed', color: 'text-green-600', bg: 'bg-green-100' },
      cancelled: { label: language === 'he' ? 'בוטל' : 'Cancelled', color: 'text-red-600', bg: 'bg-red-100' },
    };
    return config[status] ?? config.pending;
  };

  const ChevronIcon = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">{t('jobs')}</Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-white px-4 py-3 border-b border-gray-100"
        contentContainerStyle={{ gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => handleTabPress(tab.key)}
            className={cn(
              'px-4 py-2 rounded-full',
              activeTab === tab.key ? 'bg-blue-500' : 'bg-gray-100'
            )}
          >
            <Text
              className={cn(
                'font-medium',
                activeTab === tab.key ? 'text-white' : 'text-gray-600'
              )}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Jobs List */}
      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 20 }}>
        {filteredJobs.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Briefcase size={48} color="#D1D5DB" />
            <Text className="mt-4 text-gray-400 text-lg">{t('noJobs')}</Text>
          </View>
        ) : (
          filteredJobs.map((job, index) => {
            const statusBadge = getStatusBadge(job.status);
            const isActive = !['completed', 'cancelled'].includes(job.status);

            return (
              <Animated.View
                key={job.id}
                entering={FadeInUp.delay(index * 80).duration(400)}
              >
                <Pressable
                  onPress={() => handleJobPress(job)}
                  disabled={!isActive}
                  className={cn(
                    'bg-white rounded-2xl p-4 mb-3 shadow-sm shadow-black/5',
                    isActive && 'active:opacity-90'
                  )}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className={cn('px-3 py-1 rounded-full', statusBadge.bg)}>
                      <Text className={cn('font-medium text-sm', statusBadge.color)}>
                        {statusBadge.label}
                      </Text>
                    </View>
                    <Text className="text-gray-400 text-sm">
                      {format(new Date(job.created_at), 'dd/MM HH:mm', {
                        locale: language === 'he' ? he : undefined,
                      })}
                    </Text>
                  </View>

                  <View className="flex-row">
                    {/* Photo */}
                    <Image
                      source={{ uri: job.photo_url }}
                      style={{ width: 64, height: 64, borderRadius: 12 }}
                    />

                    {/* Details */}
                    <View className="flex-1 mx-3">
                      <Text className="text-gray-900 font-semibold" numberOfLines={1}>
                        {job.customer?.name ?? 'לקוח'}
                      </Text>
                      <Text className="text-gray-500 text-sm mt-1" numberOfLines={2}>
                        {job.description}
                      </Text>
                      <View className="flex-row items-center mt-2">
                        <MapPin size={12} color="#6B7280" />
                        <Text className="text-gray-400 text-xs ml-1" numberOfLines={1}>
                          {job.customer_location.address ?? 'מיקום הלקוח'}
                        </Text>
                      </View>
                    </View>

                    {/* Price & Arrow */}
                    <View className="items-end justify-between">
                      <Text className="text-gray-900 font-bold">
                        {job.final_price ? `₪${job.final_price}` : `₪${job.estimated_price_min}-${job.estimated_price_max}`}
                      </Text>
                      {isActive && <ChevronIcon size={20} color="#9CA3AF" />}
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
