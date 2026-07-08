import React from 'react';
import { View, Text, ScrollView, Pressable, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useLanguageStore } from '@/lib/store';
import { getLegalContent, LegalDocType } from '@/lib/legal-content';
import { getThemeColors } from '@/lib/theme-colors';
import { useAppThemeStore } from '@/lib/store';

export default function LegalScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const language = useLanguageStore((s) => s.language);
  const colorScheme = useAppThemeStore((s) => s.colorScheme);
  const colors = getThemeColors(colorScheme);

  const docType: LegalDocType = type === 'privacy' ? 'privacy' : 'terms';
  const { title, body } = getLegalContent(docType, language);
  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 14, lineHeight: 24, color: colors.textSecondary, textAlign: 'right' }}>{body}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}