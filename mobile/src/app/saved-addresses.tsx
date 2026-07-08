import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, MapPin, Trash2, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import ConfirmModal from '@/components/ConfirmModal';

import { useLanguageStore, useAppThemeStore } from '@/lib/store';
import { getThemeColors } from '@/lib/theme-colors';
import { SavedAddress } from '@/lib/types';
import { deleteSavedAddress, fetchSavedAddresses } from '@/lib/saved-addresses-api';

export default function SavedAddressesScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const colorScheme = useAppThemeStore((s) => s.colorScheme);
  const colors = getThemeColors(colorScheme);

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAddresses(await fetchSavedAddresses());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const updated = await deleteSavedAddress(deleteId);
      setAddresses(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>
          {t('savedAddresses')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : addresses.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 }}>
            <MapPin size={48} color={colors.textSecondary} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 17, marginTop: 16, textAlign: 'center' }}>
              {language === 'he' ? 'אין כתובות שמורות' : 'No saved addresses'}
            </Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
              {language === 'he'
                ? 'כתובות יישמרו אוטומטית לאחר פתיחת קריאת תיקון מוצלחת, או תוכל להוסיף בעת פתיחת קריאה.'
                : 'Addresses are saved after a successful repair request, or when you add one during booking.'}
            </Text>
          </View>
        ) : (
          addresses.map((addr) => (
            <View
              key={addr.id}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable onPress={() => { Haptics.selectionAsync(); setDeleteId(addr.id); }} hitSlop={8}>
                  <Trash2 size={18} color="#EF4444" />
                </Pressable>
                <View style={{ flex: 1, alignItems: 'flex-end', marginHorizontal: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {addr.isDefault && <Star size={14} color="#F59E0B" fill="#F59E0B" />}
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{addr.label}</Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, marginTop: 4, textAlign: 'right' }}>{addr.address}</Text>
                </View>
                <MapPin size={20} color={colors.primary} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!deleteId}
        title={language === 'he' ? 'מחיקת כתובת' : 'Delete address'}
        message={language === 'he' ? 'למחוק כתובת זו?' : 'Delete this address?'}
        confirmText={t('confirm')}
        cancelText={t('cancel')}
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </SafeAreaView>
  );
}