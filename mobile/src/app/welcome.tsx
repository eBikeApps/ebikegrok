import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Dimensions, FlatList, ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Camera, UserCheck, CreditCard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useLanguageStore } from '@/lib/store';
import { markWelcomeSeen } from '@/lib/welcome-storage';
import { useSession } from '@/lib/auth/use-session';
import { gradients } from '@/lib/brand-colors';

const { width } = Dimensions.get('window');

type Slide = {
  key: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  titleKey: 'welcomeSlide1Title' | 'welcomeSlide2Title' | 'welcomeSlide3Title';
  descKey: 'welcomeSlide1Desc' | 'welcomeSlide2Desc' | 'welcomeSlide3Desc';
  colors: [string, string];
};

const SLIDES: Slide[] = [
  {
    key: 'photo',
    icon: Camera,
    titleKey: 'welcomeSlide1Title',
    descKey: 'welcomeSlide1Desc',
    colors: ['#1D4ED8', '#3B82F6'],
  },
  {
    key: 'technician',
    icon: UserCheck,
    titleKey: 'welcomeSlide2Title',
    descKey: 'welcomeSlide2Desc',
    colors: ['#059669', '#10B981'],
  },
  {
    key: 'pay',
    icon: CreditCard,
    titleKey: 'welcomeSlide3Title',
    descKey: 'welcomeSlide3Desc',
    colors: ['#7C3AED', '#8B5CF6'],
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const { data: session } = useSession();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await markWelcomeSeen();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (session?.user) {
      router.replace('/(customer)/(tabs)');
      return;
    }
    router.replace('/sign-in');
  };

  const handleContinue = () => {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
      return;
    }
    finish();
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.find((item) => item.isViewable);
      if (visible?.index != null) {
        setIndex((prev) => (prev === visible.index ? prev : visible.index!));
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
  const isLastSlide = SLIDES[index]?.key === 'pay';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={finish}
          style={{ alignSelf: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}
        >
          <Text style={{ color: '#94A3B8', fontSize: 15, fontWeight: '600' }}>{t('welcomeSkip')}</Text>
        </Pressable>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index: slideIndex }) => {
            const Icon = item.icon;
            return (
              <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                <Animated.View
                  entering={FadeInUp.delay(slideIndex * 80).duration(400)}
                  style={{ alignItems: 'center', alignSelf: 'center', width: '100%' }}
                >
                  <LinearGradient
                    colors={item.colors}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 60,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 36,
                      alignSelf: 'center',
                    }}
                  >
                    <Icon size={52} color="#fff" />
                  </LinearGradient>
                  <Text
                    style={{
                      color: '#F8FAFC',
                      fontSize: 28,
                      fontWeight: '800',
                      textAlign: 'center',
                      marginBottom: 12,
                    }}
                  >
                    {t(item.titleKey)}
                  </Text>
                  <Text
                    style={{
                      color: '#94A3B8',
                      fontSize: 16,
                      textAlign: 'center',
                      lineHeight: 24,
                      maxWidth: 300,
                    }}
                  >
                    {t(item.descKey)}
                  </Text>
                </Animated.View>
              </View>
            );
          }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? '#3B82F6' : '#334155',
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Pressable onPress={handleContinue}>
          <LinearGradient
            colors={[...gradients.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
              {isLastSlide ? t('done') : t('next')}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}