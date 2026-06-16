import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, I18nManager, Modal, ActivityIndicator, Linking } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  User,
  Bell,
  Globe,
  CreditCard,
  MapPin,
  HelpCircle,
  MessageCircle,
  FileText,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Camera,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguageStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { useSession, useSignOut, SESSION_QUERY_KEY } from '@/lib/auth/use-session';
import { authClient } from '@/lib/auth/auth-client';
import { api } from '@/lib/api/api';

interface SettingItem {
  icon: typeof Bell;
  label: string;
  type: 'toggle' | 'link' | 'action';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  color?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const { data: session } = useSession();
  const signOut = useSignOut();
  const user = session?.user;

  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user?.image ?? undefined);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showPhotoErrorModal, setShowPhotoErrorModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState({ title: '', message: '' });

  useEffect(() => {
    if (user?.image) setAvatarUri(user.image);
  }, [user?.image]);

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
      setAvatarUri(user?.image ?? undefined);
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

  const settingsSections: { title: string; items: SettingItem[] }[] = [
    {
      title: t('settings'),
      items: [
        {
          icon: Bell,
          label: t('notifications'),
          type: 'toggle',
          value: notificationsEnabled,
          onToggle: (value) => {
            setNotificationsEnabled(value);
            Haptics.selectionAsync();
          },
        },
        {
          icon: Globe,
          label: t('language'),
          type: 'action',
          onPress: handleLanguageToggle,
        },
        // TODO: implement Payment Methods screen before publishing
        // {
        //   icon: CreditCard,
        //   label: t('paymentMethods'),
        //   type: 'link',
        //   onPress: () => {},
        // },
        // TODO: implement Saved Addresses screen before publishing
        // {
        //   icon: MapPin,
        //   label: t('savedAddresses'),
        //   type: 'link',
        //   onPress: () => {},
        // },
      ],
    },
    {
      title: t('support'),
      items: [
        {
          icon: HelpCircle,
          label: t('faq'),
          type: 'link',
          onPress: () => {
            setInfoModalContent({ title: t('faq'), message: t('faqContent') });
            setShowInfoModal(true);
          },
        },
        {
          icon: MessageCircle,
          label: t('contactSupport2'),
          type: 'link',
          onPress: () => { Linking.openURL('mailto:support@ebikeland.com'); },
        },
        {
          icon: FileText,
          label: t('termsConditions'),
          type: 'link',
          onPress: () => {
            setInfoModalContent({ title: t('termsConditions'), message: t('termsContent') });
            setShowInfoModal(true);
          },
        },
        {
          icon: Shield,
          label: t('privacyPolicy'),
          type: 'link',
          onPress: () => {
            setInfoModalContent({ title: t('privacyPolicy'), message: t('privacyContent') });
            setShowInfoModal(true);
          },
        },
      ],
    },
  ];

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
            <Pressable onPress={handleChangePhoto} disabled={uploadingAvatar} className="relative">
              <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center overflow-hidden">
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{ width: 96, height: 96 }}
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

            <Text className="mt-4 text-xl font-bold text-gray-900">
              {user?.name ?? 'משתמש'}
            </Text>
            <Text className="mt-1 text-gray-500">{user?.email}</Text>

            {/* TODO: implement Edit Profile screen before publishing — commented out to avoid broken interaction */}
            {/* <Pressable
              onPress={() => {}}
              className="mt-4 px-6 py-2 bg-blue-50 rounded-full"
            >
              <Text className="text-blue-600 font-semibold">{t('editProfile')}</Text>
            </Pressable> */}
          </View>
        </Animated.View>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <Animated.View
            key={section.title}
            entering={FadeInUp.delay(200 + sectionIndex * 100).duration(400)}
            className="mx-4 mt-6"
          >
            <Text className="text-gray-500 font-medium text-sm mb-2 px-2">
              {section.title}
            </Text>
            <View className="bg-white rounded-2xl overflow-hidden shadow-sm shadow-black/5">
              {section.items.map((item, itemIndex) => {
                const IconComponent = item.icon;
                const isLast = itemIndex === section.items.length - 1;

                return (
                  <Pressable
                    key={item.label}
                    onPress={item.onPress}
                    disabled={item.type === 'toggle'}
                    className={cn(
                      'flex-row items-center px-4 py-4',
                      !isLast && 'border-b border-gray-100'
                    )}
                  >
                    <View
                      className={cn(
                        'w-10 h-10 rounded-full items-center justify-center',
                        item.color ? item.color : 'bg-gray-100'
                      )}
                    >
                      <IconComponent
                        size={20}
                        color={item.color ? '#fff' : '#6B7280'}
                      />
                    </View>
                    <Text className="flex-1 mx-3 text-gray-800 font-medium text-base">
                      {item.label}
                    </Text>

                    {item.type === 'toggle' && (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                        thumbColor={item.value ? '#3B82F6' : '#fff'}
                      />
                    )}

                    {item.type === 'link' && (
                      <ChevronIcon size={20} color="#9CA3AF" />
                    )}

                    {item.type === 'action' && item.label === t('language') && (
                      <View className="bg-gray-100 px-3 py-1 rounded-full">
                        <Text className="text-gray-600 font-medium">
                          {language === 'he' ? 'עברית' : 'English'}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ))}

        {/* Sign Out Button */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
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
          entering={FadeInUp.delay(450).duration(400)}
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
          {t('appName')} v1.4.8
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
        confirmText={t('retry')}
        cancelText={t('close')}
        onConfirm={() => { setShowPhotoErrorModal(false); handleChangePhoto(); }}
        onCancel={() => setShowPhotoErrorModal(false)}
      />

      <ConfirmModal
        visible={showInfoModal}
        title={infoModalContent.title}
        message={infoModalContent.message}
        confirmText={t('close')}
        cancelText={t('close')}
        onConfirm={() => setShowInfoModal(false)}
        onCancel={() => setShowInfoModal(false)}
      />
    </SafeAreaView>
  );
}
