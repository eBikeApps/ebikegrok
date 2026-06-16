import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInUp, FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  ShieldCheck,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  UserX,
  Trash2,
  CircleDot,
  CircleOff,
  Phone,
  Mail,
  Star,
  Car,
  XCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useLanguageStore } from '@/lib/store';

interface Technician {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isApproved: boolean;
  isAvailable?: boolean;
  rating?: number;
  totalReviews?: number;
  vehicleType?: string;
  createdAt: string;
}

type TabType = 'pending' | 'active' | 'inactive' | 'all';

async function fetchAllTechnicians(): Promise<Technician[]> {
  const res = await api.get<{ technicians: Technician[] }>('/api/admin/technicians');
  return res.technicians ?? [];
}

async function approveTechnician(userId: string): Promise<void> {
  await api.post(`/api/admin/approve-technician/${userId}`, {});
}

async function revokeTechnician(userId: string): Promise<void> {
  await api.post(`/api/admin/revoke-technician/${userId}`, {});
}

async function removeTechnician(userId: string): Promise<void> {
  await api.delete(`/api/admin/technician/${userId}`);
}

const TABS: { key: TabType; labelKey: string; icon: typeof Users }[] = [
  { key: 'pending', labelKey: 'pendingApproval', icon: Clock },
  { key: 'active', labelKey: 'active', icon: CircleDot },
  { key: 'inactive', labelKey: 'inactive', icon: CircleOff },
  { key: 'all', labelKey: 'all', icon: Users },
];

export default function AdminScreen() {
  const queryClient = useQueryClient();
  const t = useLanguageStore((s) => s.t);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    destructive: boolean;
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', confirmText: '', destructive: false, onConfirm: () => {} });

  const { data: allTechnicians = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['all-technicians'],
    queryFn: fetchAllTechnicians,
  });

  const showError = (msg: string) => {
    setConfirmModal({ visible: true, title: t('error'), message: msg, confirmText: t('close'), destructive: false, onConfirm: () => setConfirmModal((s) => ({ ...s, visible: false })) });
  };

  const { mutate: approveAction } = useMutation({
    mutationFn: approveTechnician,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-technicians'] });
      setLoadingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setLoadingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError(t('approveTechnicianError'));
    },
  });

  const { mutate: revokeAction } = useMutation({
    mutationFn: revokeTechnician,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-technicians'] });
      setLoadingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setLoadingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError(t('revokeError'));
    },
  });

  const { mutate: removeAction } = useMutation({
    mutationFn: removeTechnician,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-technicians'] });
      setLoadingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setLoadingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError(t('removeError'));
    },
  });

  // Filter technicians based on active tab
  const filteredTechnicians = allTechnicians.filter((tech) => {
    switch (activeTab) {
      case 'pending':
        return !tech.isApproved;
      case 'active':
        return tech.isApproved && tech.isAvailable;
      case 'inactive':
        return tech.isApproved && !tech.isAvailable;
      case 'all':
      default:
        return true;
    }
  });

  // Count for each tab
  const counts = {
    pending: allTechnicians.filter(t => !t.isApproved).length,
    active: allTechnicians.filter(t => t.isApproved && t.isAvailable).length,
    inactive: allTechnicians.filter(t => t.isApproved && !t.isAvailable).length,
    all: allTechnicians.length,
  };

  const handleApprove = useCallback((tech: Technician) => {
    Haptics.selectionAsync();
    setConfirmModal({
      visible: true,
      title: t('approveTechnicianTitle'),
      message: `${t('approveTechnicianTitle')}: ${tech.name}?`,
      confirmText: t('approveBtn'),
      destructive: false,
      onConfirm: () => {
        setConfirmModal((s) => ({ ...s, visible: false }));
        setLoadingId(tech.id);
        approveAction(tech.id);
      },
    });
  }, [approveAction, t]);

  const handleRevoke = useCallback((tech: Technician) => {
    Haptics.selectionAsync();
    setConfirmModal({
      visible: true,
      title: t('revokeTitle'),
      message: `${t('revokeTitle')}: ${tech.name}?`,
      confirmText: t('revokeBtn'),
      destructive: true,
      onConfirm: () => {
        setConfirmModal((s) => ({ ...s, visible: false }));
        setLoadingId(tech.id);
        revokeAction(tech.id);
      },
    });
  }, [revokeAction, t]);

  const handleRemove = useCallback((tech: Technician) => {
    Haptics.selectionAsync();
    setConfirmModal({
      visible: true,
      title: t('removeTitle'),
      message: `${t('removeTitle')}: ${tech.name}?`,
      confirmText: t('removeBtn'),
      destructive: true,
      onConfirm: () => {
        setConfirmModal((s) => ({ ...s, visible: false }));
        setLoadingId(tech.id);
        removeAction(tech.id);
      },
    });
  }, [removeAction, t]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (tech: Technician) => {
    if (!tech.isApproved) {
      return { label: 'ממתין', bg: 'bg-amber-100', text: 'text-amber-700' };
    }
    if (tech.isAvailable) {
      return { label: 'פעיל', bg: 'bg-green-100', text: 'text-green-700' };
    }
    return { label: 'לא פעיל', bg: 'bg-gray-100', text: 'text-gray-600' };
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} className="bg-white px-5 pt-4 pb-4 border-b border-gray-100">
        <View className="flex-row items-center gap-3">
          <View className="w-11 h-11 bg-blue-100 rounded-full items-center justify-center">
            <ShieldCheck size={24} color="#3B82F6" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">{t('manageTechnicians')}</Text>
            <Text className="text-sm text-gray-500">{allTechnicians.length} {t('registeredCount')}</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4 -mx-1"
          contentContainerStyle={{ paddingHorizontal: 4 }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            const count = counts[tab.key];

            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab.key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                className={`flex-row items-center px-4 py-2.5 rounded-full mr-2 ${
                  isActive ? 'bg-blue-500' : 'bg-gray-100'
                }`}
              >
                <Icon size={16} color={isActive ? '#fff' : '#6B7280'} />
                <Text className={`ml-1.5 font-semibold text-sm ${isActive ? 'text-white' : 'text-gray-600'}`}>
                  {t(tab.labelKey as any)}
                </Text>
                {count > 0 && (
                  <View className={`ml-2 px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-200'}`}>
                    <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-600'}`}>
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#3B82F6" />
        }
      >
        {isLoading && filteredTechnicians.length === 0 && (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-400 mt-3">{t('loading')}</Text>
          </View>
        )}

        {isError && (
          <Animated.View entering={FadeInUp.duration(400)} className="items-center py-20 gap-3">
            <AlertCircle size={48} color="#EF4444" />
            <Text className="text-gray-500 text-center">{t('dataLoadError')}</Text>
            <Pressable onPress={() => refetch()} className="bg-blue-500 px-5 py-2 rounded-full">
              <Text className="text-white font-semibold">{t('retry')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {!isLoading && !isError && filteredTechnicians.length === 0 && (
          <Animated.View entering={FadeInUp.duration(400)} className="items-center py-20 gap-3">
            <CheckCircle2 size={52} color="#10B981" />
            <Text className="text-gray-700 font-semibold text-lg">
              {activeTab === 'pending' ? t('noPendingTechnicians') : t('noTechniciansInCategory')}
            </Text>
            <Text className="text-gray-400 text-center text-sm">
              {activeTab === 'pending' ? t('allApproved') : t('tryAnotherCategory')}
            </Text>
          </Animated.View>
        )}

        {filteredTechnicians.map((tech, index) => {
          const status = getStatusBadge(tech);
          const isProcessing = loadingId === tech.id;

          return (
            <Animated.View
              key={tech.id}
              entering={FadeInUp.delay(index * 50).duration(400)}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm shadow-black/5"
            >
              {/* Header row */}
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  {/* Avatar */}
                  <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
                    <Text className="text-blue-600 font-bold text-lg">
                      {tech.name?.charAt(0) ?? '?'}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-gray-900 font-bold text-base">{tech.name}</Text>
                      <View className={`px-2 py-0.5 rounded-full ${status.bg}`}>
                        <Text className={`text-xs font-semibold ${status.text}`}>{status.label}</Text>
                      </View>
                    </View>

                    {/* Rating */}
                    {tech.rating !== undefined && tech.rating > 0 && (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text className="text-gray-600 text-xs">
                          {tech.rating.toFixed(1)} ({tech.totalReviews ?? 0} {t('reviews')})
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Delete button */}
                <Pressable
                  onPress={() => handleRemove(tech)}
                  disabled={isProcessing}
                  className="p-2 rounded-full bg-red-50 active:bg-red-100"
                >
                  <Trash2 size={18} color="#EF4444" />
                </Pressable>
              </View>

              {/* Info row */}
              <View className="mt-3 gap-1.5">
                <View className="flex-row items-center gap-2">
                  <Mail size={13} color="#9CA3AF" />
                  <Text className="text-gray-500 text-sm">{tech.email}</Text>
                </View>
                {tech.phone && (
                  <View className="flex-row items-center gap-2">
                    <Phone size={13} color="#9CA3AF" />
                    <Text className="text-gray-500 text-sm">{tech.phone}</Text>
                  </View>
                )}
                {tech.vehicleType && (
                  <View className="flex-row items-center gap-2">
                    <Car size={13} color="#9CA3AF" />
                    <Text className="text-gray-500 text-sm">{tech.vehicleType}</Text>
                  </View>
                )}
                <View className="flex-row items-center gap-2">
                  <Clock size={13} color="#9CA3AF" />
                  <Text className="text-gray-400 text-xs">{t('registered')} {formatDate(tech.createdAt)}</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View className="flex-row gap-2 mt-4">
                {!tech.isApproved ? (
                  <Pressable
                    onPress={() => handleApprove(tech)}
                    disabled={isProcessing}
                    accessibilityLabel={t('approveTechnicianBtn')}
                    accessibilityRole="button"
                    className="flex-1 bg-blue-500 rounded-xl py-3 items-center justify-center flex-row gap-2 active:bg-blue-600"
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <UserCheck size={18} color="#fff" />
                        <Text className="text-white font-semibold">{t('approveTechnicianBtn')}</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => handleRevoke(tech)}
                    disabled={isProcessing}
                    accessibilityLabel={t('revokeAccessBtn')}
                    accessibilityRole="button"
                    className="flex-1 bg-gray-100 rounded-xl py-3 items-center justify-center flex-row gap-2 active:bg-gray-200"
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#6B7280" />
                    ) : (
                      <>
                        <XCircle size={18} color="#6B7280" />
                        <Text className="text-gray-600 font-semibold">{t('revokeAccessBtn')}</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={t('cancel')}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((s) => ({ ...s, visible: false }))}
        destructive={confirmModal.destructive}
      />
    </SafeAreaView>
  );
}
