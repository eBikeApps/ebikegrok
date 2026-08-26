import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Star, Check, PartyPopper } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { useLanguageStore, useActiveJobStore } from '@/lib/store';
import { playSystemSound } from '@/lib/system-sounds';
import { Job, RatingCategories } from '@/lib/types';
import { api } from '@/lib/api/api';
import { markActiveJobFlowFinished, shouldSkipCompletionScreen } from '@/lib/completion-flow';
import { clearCustomerActiveJobState, fetchJobById } from '@/lib/active-job-sync';
import { formatJobReference } from '@/lib/job-reference';
import { RequireAuth } from '@/components/RequireAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { firstSearchParam, safeHttpUri } from '@/lib/geo';

const ratingCategories: { key: keyof RatingCategories; labelKey: string }[] = [
  { key: 'professionalism', labelKey: 'professionalism' },
  { key: 'speed', labelKey: 'speed' },
  { key: 'cleanliness', labelKey: 'cleanliness' },
  { key: 'fair_price', labelKey: 'fairPrice' },
];

function JobCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const paramJobId = firstSearchParam(params.id);
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);

  const activeJob = useActiveJobStore((s) => s.activeJob);
  const [job, setJob] = useState<Job | null>(null);

  const [rating, setRating] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<RatingCategories>({
    professionalism: false,
    speed: false,
    cleanliness: false,
    fair_price: false,
  });
  const [feedback, setFeedback] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const jobId = paramJobId || activeJob?.id;

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      if (await shouldSkipCompletionScreen(jobId)) {
        if (!cancelled) {
          clearCustomerActiveJobState();
          router.replace('/(customer)/(tabs)');
        }
        return;
      }
      const fetched = await fetchJobById(jobId);
      if (!cancelled && fetched) setJob(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, router]);

  const finishAndGoHome = async () => {
    if (jobId) await markActiveJobFlowFinished(jobId);
    clearCustomerActiveJobState();
    router.replace('/(customer)/(tabs)');
  };

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

  const handleSubmit = async () => {
    if (rating === 0 || !jobId || submitting) {
      if (rating === 0) playSystemSound('error');
      return;
    }

    setSubmitting(true);
    try {
      const categoryNotes = ratingCategories
        .filter((c) => selectedCategories[c.key])
        .map((c) => t(c.labelKey as keyof typeof t))
        .join(', ');
      const comment = [feedback.trim(), categoryNotes].filter(Boolean).join(' — ') || undefined;

      await api.post('/api/reviews', { jobId, rating, comment });
      await markActiveJobFlowFinished(jobId);
      playSystemSound('complete');
      setShowSuccess(true);
      setTimeout(() => {
        clearCustomerActiveJobState();
        router.replace('/(customer)/(tabs)');
      }, 1500);
    } catch (err: any) {
      if (err?.status === 409) {
        await markActiveJobFlowFinished(jobId);
        clearCustomerActiveJobState();
        router.replace('/(customer)/(tabs)');
        return;
      }
      playSystemSound('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    Haptics.selectionAsync();
    await finishAndGoHome();
  };

  const displayJob = job ?? activeJob;
  const hasFinalPrice = displayJob?.final_price !== undefined && displayJob.final_price !== null;
  const totalPrice = hasFinalPrice
    ? (displayJob!.final_price as number)
    : (displayJob?.estimated_price_min ?? 0);
  const priceLabel =
    language === 'he'
      ? hasFinalPrice
        ? 'מחיר סופי'
        : 'הערכת מחיר'
      : hasFinalPrice
        ? 'Final price'
        : 'Estimated price';
  const isPaid = displayJob?.payment_status === 'paid';
  const paymentLabel = isPaid
    ? language === 'he'
      ? 'שולם'
      : 'Paid'
    : language === 'he'
      ? 'ממתין לתשלום'
      : 'Payment pending';

  if (showSuccess) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <LinearGradient colors={['#EBF4FF', '#F0FDF4', '#EBF4FF']} style={styles.successFill}>
          <Animated.View entering={ZoomIn.duration(400)} style={styles.successCard}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
            )}
            <View style={[StyleSheet.absoluteFill, styles.successWash]} />
            <View style={styles.successInner}>
              <View style={styles.successOrb}>
                <LinearGradient colors={['#34D399', '#059669']} style={StyleSheet.absoluteFill} />
                <Check size={40} color="#fff" strokeWidth={2.8} />
              </View>
              <Text style={styles.successTitle}>{t('thankYouFeedback')}</Text>
              <Text style={styles.successSub}>
                {language === 'he'
                  ? 'המשוב שלך עוזר לנו להשתפר'
                  : 'Your feedback helps us improve'}
              </Text>
            </View>
            <View style={styles.cardBorder} pointerEvents="none" />
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Success header */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.header}>
          <View style={styles.headerOrb}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
            )}
            <View style={[StyleSheet.absoluteFill, styles.headerOrbWash]} />
            <PartyPopper size={36} color="#059669" />
            <View style={styles.orbBorder} pointerEvents="none" />
          </View>
          <Text style={styles.pageTitle}>{t('repairSuccess')}</Text>
        </Animated.View>

        {/* Job summary glass card */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.summaryCard}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.blueWash]} />
          <View style={styles.summaryInner}>
            <View style={styles.summaryTop}>
              <Text style={styles.summaryLabel}>{t('jobSummary')}</Text>
              {!!formatJobReference(displayJob?.job_number) && (
                <View style={styles.refPill}>
                  <Text style={styles.refText}>{formatJobReference(displayJob?.job_number)}</Text>
                </View>
              )}
            </View>

            {displayJob?.technician && (
              <View style={styles.techRow}>
                {safeHttpUri(displayJob.technician.avatar_url) ? (
                  <Image
                    source={{ uri: safeHttpUri(displayJob.technician.avatar_url)! }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>
                      {(displayJob.technician.name || '?').charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.techName}>{displayJob.technician.name}</Text>
                  <View style={styles.ratingRow}>
                    <Star size={14} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.ratingText}>{displayJob.technician.rating}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{priceLabel}</Text>
              <Text style={styles.priceValue}>₪{totalPrice}</Text>
            </View>

            <View style={[styles.payPill, isPaid ? styles.payPillPaid : styles.payPillPending]}>
              <Check size={16} color={isPaid ? '#1D4ED8' : '#D97706'} />
              <Text style={[styles.payPillText, isPaid ? styles.payTextPaid : styles.payTextPending]}>
                {paymentLabel}
              </Text>
            </View>
          </View>
          <View style={styles.cardBorder} pointerEvents="none" />
        </Animated.View>

        {/* Rating section */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.ratingSection}>
          <Text style={styles.rateTitle}>{t('rateService')}</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable key={value} onPress={() => handleRating(value)} style={styles.starBtn}>
                <Star
                  size={42}
                  color="#F59E0B"
                  fill={value <= rating ? '#F59E0B' : 'transparent'}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.chipsWrap}>
            {ratingCategories.map((cat) => {
              const isSelected = selectedCategories[cat.key];
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => toggleCategory(cat.key)}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {t(cat.labelKey as keyof typeof t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.feedbackBox}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder={t('additionalFeedback')}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              style={styles.feedbackInput}
              textAlignVertical="top"
            />
            <View style={styles.feedbackBorder} pointerEvents="none" />
          </View>
        </Animated.View>
      </ScrollView>

      {/* Glass footer buttons */}
      <View style={styles.footer}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(235,244,255,0.95)' }]} />
        )}
        <View style={[StyleSheet.absoluteFill, styles.footerWash]} />

        <Pressable
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
          style={({ pressed }) => [
            styles.primaryCta,
            (rating === 0 || submitting) && { opacity: 0.48 },
            pressed && rating > 0 && !submitting && { opacity: 0.9 },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(96,165,250,0.92)',
              'rgba(37,99,235,0.96)',
              'rgba(29,78,216,0.98)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.4)', 'transparent']}
            style={styles.primarySheen}
          />
          <Text style={styles.primaryText}>
            {submitting
              ? language === 'he'
                ? 'שולח...'
                : 'Submitting...'
              : t('submitRating')}
          </Text>
          <View style={styles.primaryBorder} pointerEvents="none" />
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [styles.skipCta, pressed && { opacity: 0.88 }]}
        >
          <View style={[StyleSheet.absoluteFill, styles.skipWash]} />
          <Text style={styles.skipText}>{t('skipForNow')}</Text>
          <View style={styles.skipBorder} pointerEvents="none" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EBF4FF',
  },
  successFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  successCard: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  successWash: {
    backgroundColor: 'rgba(167, 243, 208, 0.28)',
  },
  successInner: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 28,
  },
  successOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(167,243,208,0.6)',
  },
  successTitle: {
    color: '#064E3B',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSub: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  header: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
  },
  headerOrb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  headerOrbWash: {
    backgroundColor: 'rgba(167, 243, 208, 0.4)',
  },
  orbBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  pageTitle: {
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  androidGlass: {
    backgroundColor: 'rgba(239, 246, 255, 0.9)',
  },
  blueWash: {
    backgroundColor: 'rgba(191, 219, 254, 0.32)',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  summaryInner: {
    padding: 18,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(147, 197, 253, 0.5)',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryLabel: {
    color: '#1E40AF',
    fontSize: 16,
    fontWeight: '800',
  },
  refPill: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  refText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    backgroundColor: 'rgba(219,234,254,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
  },
  avatarLetter: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 18,
  },
  techName: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    color: '#64748B',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(147,197,253,0.35)',
    marginBottom: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
  },
  priceValue: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 20,
  },
  payPill: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  payPillPaid: {
    backgroundColor: 'rgba(219,234,254,0.7)',
    borderColor: 'rgba(147,197,253,0.55)',
  },
  payPillPending: {
    backgroundColor: 'rgba(254,243,199,0.7)',
    borderColor: 'rgba(252,211,77,0.5)',
  },
  payPillText: {
    fontWeight: '700',
    fontSize: 14,
  },
  payTextPaid: {
    color: '#1D4ED8',
  },
  payTextPending: {
    color: '#B45309',
  },
  ratingSection: {
    marginHorizontal: 16,
  },
  rateTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  starBtn: {
    padding: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(203,213,225,0.9)',
  },
  chipSelected: {
    backgroundColor: 'rgba(59,130,246,0.9)',
    borderColor: 'rgba(147,197,253,0.8)',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  chipText: {
    fontWeight: '700',
    color: '#475569',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  feedbackBox: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    minHeight: 120,
  },
  feedbackInput: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '500',
    minHeight: 110,
    padding: 16,
    textAlign: 'right',
  },
  feedbackBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.45)',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(147,197,253,0.3)',
    overflow: 'hidden',
  },
  footerWash: {
    backgroundColor: 'rgba(191,219,254,0.22)',
  },
  primaryCta: {
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  primarySheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.2,
  },
  primaryBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(191,219,254,0.7)',
  },
  skipCta: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipWash: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  skipText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 15,
  },
  skipBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
});

export default function JobCompleteRoute() {
  return (
    <RequireAuth>
      <ErrorBoundary>
        <JobCompleteScreen />
      </ErrorBoundary>
    </RequireAuth>
  );
}
