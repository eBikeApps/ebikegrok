import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from './i18n';

const LANGUAGE_STORAGE_KEY = 'language-storage';

export function isRtlLanguage(lang: Language): boolean {
  return lang === 'he';
}

export async function readStoredLanguage(): Promise<Language> {
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!raw) return 'he';
    const parsed = JSON.parse(raw) as { state?: { language?: Language } };
    return parsed?.state?.language === 'en' ? 'en' : 'he';
  } catch {
    return 'he';
  }
}

export function applyRtlForLanguage(lang: Language): boolean {
  const shouldRtl = isRtlLanguage(lang);
  if (I18nManager.isRTL === shouldRtl) return false;
  I18nManager.allowRTL(shouldRtl);
  I18nManager.forceRTL(shouldRtl);
  return true;
}