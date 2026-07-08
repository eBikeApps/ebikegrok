import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useLanguageStore, useAppThemeStore } from '@/lib/store';
import { getThemeColors } from '@/lib/theme-colors';
import { useSession, SESSION_QUERY_KEY } from '@/lib/auth/use-session';
import { api } from '@/lib/api/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const colorScheme = useAppThemeStore((s) => s.colorScheme);
  const colors = getThemeColors(colorScheme);
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [name, setName] = useState(session?.user?.name ?? '');
  const [phone, setPhone] = useState('');

  React.useEffect(() => {
    api.get<{ user: { phone?: string } }>('/api/me').then((me) => {
      if (me.user?.phone) setPhone(me.user.phone.replace(/\D/g, '').slice(0, 10));
    }).catch(() => {});
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/api/users/me', {
        name: name.trim(),
        phone: phone.trim() || null,
      });
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      router.back();
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>
          {t('editProfile')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        <View>
          <Text style={{ color: colors.textSecondary, marginBottom: 8, textAlign: 'right' }}>{t('name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, textAlign: 'right' }}
          />
        </View>
        <View>
          <Text style={{ color: colors.textSecondary, marginBottom: 8, textAlign: 'right' }}>{t('phone')}</Text>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, textAlign: 'right' }}
          />
        </View>
        <View>
          <Text style={{ color: colors.textSecondary, marginBottom: 8, textAlign: 'right' }}>{t('email')}</Text>
          <TextInput
            value={session?.user?.email ?? ''}
            editable={false}
            style={{ backgroundColor: colors.background, borderRadius: 12, padding: 14, color: colors.textSecondary, borderWidth: 1, borderColor: colors.border, textAlign: 'right' }}
          />
        </View>

        <Pressable
          onPress={() => saveMutation.mutate()}
          disabled={!name.trim() || saveMutation.isPending}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: !name.trim() || saveMutation.isPending ? 0.6 : 1, marginTop: 8 }}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('save')}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}