import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn, ZoomIn } from 'react-native-reanimated';
import { Star, Check, PartyPopper } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';

import { useLanguageStore, useActiveJobStore } from '@/lib/store';
import { playSystemSound } from '@/lib/system-sounds';
import { RatingCategories } from '@/lib/types';
import { cn } from '@/lib/cn';

const ratingCategories: { key: keyof RatingCategories; labelKey: string }[] = [
  { key: 'professionalism', labelKey: 'professionalism' },
  { key: 'speed', labelKey: 'speed' },
  { key: 'cleanliness', labelKey: 'cleanliness' },
  { key: 'fair_price', labelKey: 'fairPrice' },
];

export default function JobCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);

  const activeJob = useActiveJobStore((s) => s.activeJob);
  const setActiveJob = useActiveJobStore((s) => s.setActiveJob);

  const [rating, setRating] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<RatingCategories>({
    professionalism: false,
    speed: false,
    cleanliness: false,
    fair_price: false,
  });
  const [feedback, setFeedback] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRating = (value: number) => {
    Haptics.selectionAsync();
    setRating(value);
  };

  const toggleCategory = (key: keyof RatingCategories) => {
    Haptics.selectionAsync();
    setSelectedCategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = () => {
    if (rating === 0) {
      playSystemSound('error');
      return;
    }

    playSystemSound('complete');
    setShowSuccess(true);

    // In real app, submit rating to backend
    setTimeout(() => {
      setActiveJob(null);
      router.replace('/(customer)/(tabs)');
    }, 2000);
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    setActiveJob(null);
    router.replace('/(customer)/(tabs)');
  };

  // Use the final price set by the technician; fall back to estimate only if never set
  const hasFinalPrice = activeJob?.final_price !== undefined && activeJob.final_price !== null;
  const totalPrice = hasFinalPrice ? (activeJob!.final_price as number) : (activeJob?.estimated_price_min ?? 0);
  const priceLabel = hasFinalPrice ? 'מחיר סופי' : 'הערכת מחיר';

  if (showSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Animated.View entering={ZoomIn.duration(400)} className="items-center">
          <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
            <Check size={48} color="#10B981" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 text-center">
            {t('thankYouFeedback')}
          </Text>
          <Text className="text-gray-500 text-center mt-2">
            {language === 'he'
              ? 'המשוב שלך עוזר לנו להשתפר'
              : 'Your feedback helps us improve'}
          </Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Success Header */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          className="items-center pt-8 pb-6"
        >
          <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
            <PartyPopper size={40} color="#10B981" />
          </View>
          <Text className="text-2xl font-bold text-gray-900">{t('repairSuccess')}</Text>
        </Animated.View>

        {/* Job Summary */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          className="mx-4 bg-gray-50 rounded-2xl p-4 mb-6"
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-700 font-semibold">{t('jobSummary')}</Text>
            {activeJob?.job_number && (
              <View className="bg-blue-100 rounded-full px-3 py-1">
                <Text className="text-blue-600 text-xs font-bold">#{activeJob.job_number}</Text>
              </View>
            )}
          </View>

          {/* Technician */}
          {activeJob?.technician && (
            <View className="flex-row items-center mb-4 pb-4 border-b border-gray-200">
              <Image
                source={{ uri: activeJob.technician.avatar_url }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
              <View className="ml-3">
                <Text className="text-gray-900 font-semibold">
                  {activeJob.technician.name}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text className="text-gray-500 text-sm ml-1">
                    {activeJob.technician.rating}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Price */}
          <View className="gap-2">
            <View className="h-px bg-gray-200 mb-2" />
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-900 font-bold">{priceLabel}</Text>
              <Text className="text-blue-600 font-bold text-lg">₪{totalPrice}</Text>
            </View>
          </View>

          {/* Payment Status */}
          <View className="mt-4 bg-blue-100 rounded-xl p-3 flex-row items-center justify-center">
            <Check size={18} color="#3B82F6" />
            <Text className="text-blue-700 font-medium ml-2">
              {language === 'he' ? 'שולם בכרטיס אשראי' : 'Paid by Credit Card'}
            </Text>
          </View>
        </Animated.View>

        {/* Rating Section */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="mx-4"
        >
          <Text className="text-xl font-bold text-gray-900 text-center mb-4">
            {t('rateService')}
          </Text>

          {/* Stars */}
          <View className="flex-row justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => handleRating(value)}
                className="p-1"
              >
                <Star
                  size={40}
                  color="#F59E0B"
                  fill={value <= rating ? '#F59E0B' : 'transparent'}
                />
              </Pressable>
            ))}
          </View>

          {/* Categories */}
          <View className="flex-row flex-wrap gap-2 mb-6">
            {ratingCategories.map((cat) => {
              const isSelected = selectedCategories[cat.key];
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => toggleCategory(cat.key)}
                  className={cn(
                    'px-4 py-2 rounded-full border',
                    isSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-white border-gray-200'
                  )}
                >
                  <Text
                    className={cn(
                      'font-medium',
                      isSelected ? 'text-white' : 'text-gray-600'
                    )}
                  >
                    {t(cat.labelKey as keyof typeof t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Feedback */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-6">
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder={t('additionalFeedback')}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              className="text-gray-900 text-base"
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-white px-4 pb-8 pt-4 border-t border-gray-100">
        <Pressable
          onPress={handleSubmit}
          disabled={rating === 0}
          className={cn('rounded-2xl overflow-hidden', rating === 0 && 'opacity-50')}
        >
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 16, alignItems: 'center' }}
          >
            <Text className="text-white font-bold text-lg">{t('submitRating')}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={handleSkip} className="py-4 items-center">
          <Text className="text-gray-500 font-medium">{t('skipForNow')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
