import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import { brand } from '@/lib/brand-colors';
import { useLanguageStore } from '@/lib/store';
import { DotLoader } from './DotLoader';
import { safeHttpUri } from '@/lib/geo';

export function PaymentRequiredScreen({
  technician,
  totalPrice,
  onPayNow,
  onCancel,
  onSimulatePay,
  mockPayments,
  paymentLoading,
}: {
  technician?: { name?: string; avatar_url?: string };
  totalPrice: number;
  onPayNow: () => void;
  onCancel: () => void;
  onSimulatePay?: () => void;
  mockPayments?: boolean;
  paymentLoading: boolean;
}) {
  const insets = useSafeAreaInsets();
  const t = useLanguageStore((s) => s.t);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 12 });
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0F172A', '#0D2137', '#0F172A']} style={styles.gradient}>
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          style={[styles.header, { paddingTop: insets.top + 40 }]}
        >
          <Animated.View style={[styles.checkOrb, checkStyle]}>
            <LinearGradient
              colors={['#22C55E', '#166534']}
              style={StyleSheet.absoluteFill}
            />
            <Check size={36} color="#fff" strokeWidth={2.8} />
          </Animated.View>
          <Text style={styles.title}>הטכנאי מוכן לצאת!</Text>
          <Text style={styles.subtitle}>כדי לאשר את הביקור, יש לשלם כעת</Text>
        </Animated.View>

        {technician && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.techCard}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.glassAndroid]} />
            )}
            <View style={[StyleSheet.absoluteFill, styles.techWash]} />
            <View style={styles.techInner}>
              <View style={styles.avatar}>
                {safeHttpUri(technician.avatar_url) ? (
                  <Image
                    source={{ uri: safeHttpUri(technician.avatar_url)! }}
                    style={{ width: 56, height: 56, borderRadius: 28 }}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>{technician.name?.charAt(0) ?? '?'}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.techName}>{technician.name}</Text>
                <Text style={styles.techMeta}>טכנאי מוסמך • ממתין לתשלום</Text>
              </View>
            </View>
            <View style={styles.cardBorder} pointerEvents="none" />
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.priceCard}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.glassAndroid]} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.priceWash]} />
          <View style={styles.priceInner}>
            <Text style={styles.priceLabel}>
              {t('paymentTotal')}: ₪{totalPrice}
            </Text>
            <Text style={styles.priceValue}>₪{totalPrice}</Text>
            <Text style={styles.priceNote}>{t('fixedPriceSubtitle')}</Text>
          </View>
          <View style={[styles.cardBorder, styles.priceBorder]} pointerEvents="none" />
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}
        >
          {/* Pay now — glass blue CTA */}
          <Pressable
            onPress={onPayNow}
            disabled={paymentLoading}
            style={({ pressed }) => [
              styles.primaryCta,
              (pressed || paymentLoading) && { opacity: 0.85 },
            ]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(37,99,235,0.35)' }]} />
            )}
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
              colors={['rgba(255,255,255,0.45)', 'transparent']}
              style={styles.primarySheen}
            />
            {paymentLoading ? (
              <View style={styles.loadingRow}>
                <DotLoader delay={0} />
                <DotLoader delay={200} />
                <DotLoader delay={400} />
              </View>
            ) : (
              <Text style={styles.primaryText}>
                {mockPayments ? '💳 שלם (תשלום לדוגמה)' : '💳  שלם עכשיו'}
              </Text>
            )}
            <View style={styles.primaryBorder} pointerEvents="none" />
          </Pressable>

          {onSimulatePay && (
            <Pressable
              onPress={onSimulatePay}
              disabled={paymentLoading}
              style={({ pressed }) => [
                styles.secondaryCta,
                (pressed || paymentLoading) && { opacity: 0.65 },
              ]}
            >
              {Platform.OS === 'ios' ? (
                <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.glassAndroid]} />
              )}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(251,191,36,0.12)' }]} />
              <Text style={styles.secondaryText}>⚡ תשלום מיידי ללא כרטיס (בדיקה)</Text>
              <View style={styles.secondaryBorder} pointerEvents="none" />
            </Pressable>
          )}

          {/* Cancel — glass red */}
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelCta, pressed && { opacity: 0.88 }]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.glassAndroid]} />
            )}
            <LinearGradient
              colors={['rgba(248,113,113,0.28)', 'rgba(239,68,68,0.16)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.14)', 'transparent']}
              style={styles.cancelSheen}
            />
            <Text style={styles.cancelText}>בטל הזמנה</Text>
            <View style={styles.cancelBorder} pointerEvents="none" />
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  gradient: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 32,
  },
  checkOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(134,239,172,0.45)',
    shadowColor: '#22C55E',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  techCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  glassAndroid: {
    backgroundColor: 'rgba(30, 41, 59, 0.88)',
  },
  techWash: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  techInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: brand.primaryDeeper,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.4)',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  techName: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  techMeta: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.28)',
  },
  priceCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    borderRadius: 22,
    overflow: 'hidden',
  },
  priceWash: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
  },
  priceInner: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  priceBorder: {
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  priceLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 6,
  },
  priceValue: {
    color: brand.primaryLight,
    fontSize: 52,
    fontWeight: '900',
  },
  priceNote: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    gap: 14,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
  },
  primaryCta: {
    borderRadius: 32,
    overflow: 'hidden',
    minHeight: 140,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  primarySheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 28,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  primaryBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: 'rgba(191, 219, 254, 0.8)',
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  secondaryCta: {
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryText: {
    color: '#FBBF24',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  cancelCta: {
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#EF4444',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cancelSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  cancelText: {
    color: '#FECACA',
    fontWeight: '800',
    fontSize: 19,
    textAlign: 'center',
  },
  cancelBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
});
