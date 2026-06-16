import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Switch, I18nManager, TextInput, Modal, ActivityIndicator } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  User,
  Bell,
  Globe,
  Shield,
  MapPin,
  Wrench,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Camera,
  Star,
  Edit2,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguageStore, useTechnicianStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { useSession, useSignOut, SESSION_QUERY_KEY } from '@/lib/auth/use-session';
import { authClient } from '@/lib/auth/auth-client';
import { api } from '@/lib/api/api';

export default function TechnicianProfileScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const { data: session } = useSession();
  const signOut = useSignOut();
  const user = session?.user;
  const profile = useTechnicianStore((s) => s.profile);

  // Use session user data (real user) with fallback to mock profile
  const displayName = user?.name ?? profile?.name ?? 'טכנאי';
  const displayAvatar = user?.image ?? profile?.avatar_url;

  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(displayAvatar ?? undefined);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bio, setBio] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showPhotoErrorModal, setShowPhotoErrorModal] = useState(false);

  useEffect(() => {
    if (displayAvatar) setAvatarUri(displayAvatar);
  }, [displayAvatar]);

  const uploadAvatarMutation = useMutation({
    mutationFn: async (dataUrl: string) => {
      const sessionResult = await authClient.getSession();
      const token = (sessionResult as any)?.data?.session?.token;
      if (!token) throw new Error('No session token');

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/users/me`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      const json = text ? JSON.parse(text) : null;
      const savedImage: string = json?.user?.image ?? dataUrl;
      return savedImage;
    },
    onSuccess: (savedImage) => {
      setAvatarUri(savedImage);
      queryClient.setQueryData(SESSION_QUERY_KEY, (old: any) => {
        if (!old) return old;
        return { ...old, user: { ...old.user, image: savedImage } };
      });
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setAvatarUri(displayAvatar ?? undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setShowPhotoErrorModal(true);
    },
  });

  const handleChangePhoto = async () => {
    Haptics.selectionAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setAvatarUri(asset.uri);
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    uploadAvatarMutation.mutate(dataUrl);
  };

  const uploadingAvatar = uploadAvatarMutation.isPending;

  const handleLanguageToggle = () => {
    Haptics.selectionAsync();
    setLanguage(language === 'he' ? 'en' : 'he');
  };

  const handleSaveBio = () => {
    Haptics.selectionAsync();
    setIsEditingBio(false);
    // In real app, save to backend
  };

  const handleSignOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    setShowSignOutModal(false);
    await signOut();
    router.replace('/sign-in');
  };

  const handleDeleteAccount = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setIsDeleting(true);
    try {
      await api.delete('/api/users/me');
      await signOut();
      router.replace('/sign-in');
    } catch {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const ChevronIcon = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  const getVerificationBadge = () => {
    const status = profile?.verification_status ?? 'pending';
    const config = {
      pending: { label: t('pending'), color: 'text-yellow-600', bg: 'bg-yellow-100' },
      verified: { label: t('verified'), color: 'text-green-600', bg: 'bg-green-100' },
      rejected: { label: t('rejected'), color: 'text-red-600', bg: 'bg-red-100' },
    };
    return config[status];
  };

  const badge = getVerificationBadge();

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-4 py-4 bg-white">
          <Text className="text-2xl font-bold text-gray-900">{t('profile')}</Text>
        </View>

        {/* Profile Card */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          className="mx-4 mt-4 bg-white rounded-2xl p-6 shadow-sm shadow-black/5"
        >
          <View className="items-center">
            {/* Avatar */}
            <Pressable onPress={handleChangePhoto} disabled={uploadingAvatar} className="relative">
              <View className="w-24 h-24 rounded-full overflow-hidden bg-blue-100 items-center justify-center">
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{ width: 96, height: 96, borderRadius: 48 }}
                    contentFit="cover"
                  />
                ) : (
                  <User size={40} color="#3B82F6" />
                )}
                {uploadingAvatar && (
                  <View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </View>
              <View className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500 rounded-full items-center justify-center border-2 border-white">
                <Camera size={16} color="#fff" />
              </View>
            </Pressable>

            {/* Name & Rating */}
            <Text className="mt-4 text-xl font-bold text-gray-900">
              {displayName}
            </Text>

            <View className="flex-row items-center mt-2">
              <Star size={18} color="#F59E0B" fill="#F59E0B" />
              <Text className="ml-1 text-gray-700 font-semibold">
                {profile?.rating ?? 0}
              </Text>
              <Text className="text-gray-500 ml-1">
                ({profile?.total_reviews ?? 0} {t('reviews')})
              </Text>
            </View>

            {/* Verification Badge */}
            <View className={cn('mt-3 px-4 py-1.5 rounded-full flex-row items-center', badge.bg)}>
              <Shield size={14} className={badge.color} />
              <Text className={cn('ml-1 font-medium', badge.color)}>
                {badge.label} {profile?.verification_status === 'verified' && '✓'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Bio Section */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          className="mx-4 mt-6"
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-700 font-semibold">{t('bio')}</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                if (isEditingBio) {
                  handleSaveBio();
                } else {
                  setIsEditingBio(true);
                }
              }}
            >
              <Text className="text-blue-600 font-medium">
                {isEditingBio ? t('save') : t('edit')}
              </Text>
            </Pressable>
          </View>

          <View className="bg-white rounded-2xl p-4 shadow-sm shadow-black/5">
            {isEditingBio ? (
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                maxLength={200}
                className="text-gray-700 text-base"
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                autoFocus
              />
            ) : (
              <Text className="text-gray-600 leading-6">
                {bio || (language === 'he' ? 'הוסף תיאור קצר...' : 'Add a short description...')}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Service Details */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="mx-4 mt-6"
        >
          <Text className="text-gray-700 font-semibold mb-2">{t('serviceDetails')}</Text>
          <View className="bg-white rounded-2xl shadow-sm shadow-black/5 overflow-hidden">
            <View className="flex-row items-center p-4 border-b border-gray-100">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center">
                <Wrench size={20} color="#3B82F6" />
              </View>
              <View className="flex-1 mx-3">
                <Text className="text-gray-500 text-sm">{t('vehicleType')}</Text>
                <Text className="text-gray-900 font-medium">
                  {profile?.vehicle_type ?? '-'}
                </Text>
              </View>
              <ChevronIcon size={20} color="#9CA3AF" />
            </View>

            <View className="flex-row items-center p-4 border-b border-gray-100">
              <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center">
                <MapPin size={20} color="#10B981" />
              </View>
              <View className="flex-1 mx-3">
                <Text className="text-gray-500 text-sm">{t('serviceRadius')}</Text>
                <Text className="text-gray-900 font-medium">
                  {profile?.service_radius ?? 0} {language === 'he' ? 'ק״מ' : 'km'}
                </Text>
              </View>
              <ChevronIcon size={20} color="#9CA3AF" />
            </View>

            <View className="flex-row items-center p-4">
              <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center">
                <Text className="text-purple-600 font-bold">₪</Text>
              </View>
              <View className="flex-1 mx-3">
                <Text className="text-gray-500 text-sm">{t('basePrice')}</Text>
                <Text className="text-gray-900 font-medium">
                  ₪{profile?.base_price ?? 0}
                </Text>
              </View>
              <ChevronIcon size={20} color="#9CA3AF" />
            </View>
          </View>
        </Animated.View>

        {/* Settings */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          className="mx-4 mt-6"
        >
          <Text className="text-gray-700 font-semibold mb-2">{t('settings')}</Text>
          <View className="bg-white rounded-2xl shadow-sm shadow-black/5 overflow-hidden">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                  <Bell size={20} color="#6B7280" />
                </View>
                <Text className="ml-3 text-gray-800 font-medium">{t('notifications')}</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={(value) => {
                  setNotificationsEnabled(value);
                  Haptics.selectionAsync();
                }}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={notificationsEnabled ? '#3B82F6' : '#fff'}
              />
            </View>

            <Pressable
              onPress={handleLanguageToggle}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                  <Globe size={20} color="#6B7280" />
                </View>
                <Text className="ml-3 text-gray-800 font-medium">{t('language')}</Text>
              </View>
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-gray-600 font-medium">
                  {language === 'he' ? 'עברית' : 'English'}
                </Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* Sign Out */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          className="mx-4 mt-6"
        >
          <Pressable
            onPress={handleSignOut}
            className="bg-white rounded-2xl p-4 flex-row items-center justify-center shadow-sm shadow-black/5 active:bg-red-50"
          >
            <LogOut size={20} color="#EF4444" />
            <Text className="ml-2 text-red-500 font-semibold text-base">
              {t('signOut')}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Delete Account */}
        <Animated.View
          entering={FadeInUp.delay(550).duration(400)}
          className="mx-4 mt-3"
        >
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setShowDeleteModal(true);
            }}
            className="flex-row items-center justify-center py-3"
          >
            <Trash2 size={16} color="#9CA3AF" />
            <Text className="ml-1.5 text-gray-400 text-sm">
              {t('deleteAccount')}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Delete Account Modal */}
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
              <View className="w-12 h-1 bg-gray-200 rounded-full self-center mb-6" />
              <View className="w-14 h-14 bg-red-100 rounded-full items-center justify-center self-center mb-4">
                <Trash2 size={26} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold text-gray-900 text-center mb-3">
                {t('deleteAccountTitle')}
              </Text>
              <Text className="text-gray-500 text-center text-sm leading-6 mb-8">
                {t('deleteAccountWarning')}
              </Text>
              <Pressable
                onPress={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-red-500 rounded-2xl py-4 items-center mb-3 active:bg-red-600"
                style={{ opacity: isDeleting ? 0.6 : 1 }}
              >
                <Text className="text-white font-bold text-base">
                  {isDeleting
                    ? (language === 'he' ? 'מוחק...' : 'Deleting...')
                    : t('deleteAccountConfirm')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="py-4 items-center"
              >
                <Text className="text-gray-500 font-semibold text-base">{t('cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Version */}
        <Text className="text-center text-gray-400 text-sm mt-6">
          {t('appName')} v1.0.0 (טכנאי)
        </Text>
      </ScrollView>

      <ConfirmModal
        visible={showSignOutModal}
        title={t('signOut')}
        message={t('signOutConfirmMsg')}
        confirmText={t('signOut')}
        cancelText={t('cancel')}
        onConfirm={confirmSignOut}
        onCancel={() => setShowSignOutModal(false)}
        destructive
        centered
      />

      <ConfirmModal
        visible={showPhotoErrorModal}
        title={t('error')}
        message={t('photoUploadError')}
        confirmText={t('close')}
        cancelText={t('close')}
        onConfirm={() => setShowPhotoErrorModal(false)}
        onCancel={() => setShowPhotoErrorModal(false)}
      />
    </SafeAreaView>
  );
}
