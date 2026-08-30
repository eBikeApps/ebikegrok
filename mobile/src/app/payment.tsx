import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';
import { X, ShieldCheck, CheckCircle2, XCircle, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { authClient } from '@/lib/auth/auth-client';
import { RequireAuth } from '@/components/RequireAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLanguageStore } from '@/lib/store';
import { firstSearchParam } from '@/lib/geo';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

type PaymentState = 'loading' | 'ready' | 'processing' | 'success' | 'failed';

function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useLanguageStore((s) => s.t);
  const rawParams = useLocalSearchParams<{
    jobId?: string;
    paymentUrl?: string;
    amount?: string;
    description?: string;
    extraId?: string;
  }>();
  const jobId = firstSearchParam(rawParams.jobId);
  const extraId = firstSearchParam(rawParams.extraId);
  const description = firstSearchParam(rawParams.description) || undefined;
  const amount = firstSearchParam(rawParams.amount);
  const paymentUrl = (() => {
    const raw = firstSearchParam(rawParams.paymentUrl);
    if (!raw) return '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const [state, setState] = useState<PaymentState>('loading');
  const [failReason, setFailReason] = useState<string>('');
  const [webviewKey, setWebviewKey] = useState(0);
  const webviewRef = useRef<WebView>(null);
  const isMounted = useRef(true);

  const setFailed = (reason: string) => {
    setFailReason(reason);
    setState('failed');
  };

  const reasonFromUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      const keys = [
        'status_error_details',
        'status_error_code',
        'error_description',
        'error',
        'message',
        'reason',
        'status_code',
      ];
      for (const key of keys) {
        const val = parsed.searchParams.get(key);
        if (val?.trim()) {
          try {
            return decodeURIComponent(val.replace(/\+/g, ' ')).trim();
          } catch {
            return val.trim();
          }
        }
      }
    } catch {
      // relative / partial URLs — fall through
    }
    if (/cancel/i.test(url) && !/fail/i.test(url)) {
      return 'התשלום בוטל';
    }
    return 'לא הצלחנו לעבד את התשלום. אנא נסה שנית';
  };

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Polling fallback: if the provider redirect URL changes, we still catch the payment
  useEffect(() => {
    if (state === 'success' || state === 'failed' || !jobId) return;
    const interval = setInterval(async () => {
      try {
        const result = await authClient.getSession();
        const token = (result as any)?.data?.session?.token;
        if (!token) return;
        const res = await fetch(`${BACKEND_URL}/api/payments/status/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted.current) return;
        if (data?.paymentStatus === 'paid') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setState('success');
        }
      } catch {
        // silent — URL detection is the primary path
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state, jobId]);

  const amountNum = Number(amount ?? 0);
  const isMockCheckout = (paymentUrl ?? '').includes('/api/payments/mock/');

  const classifyCheckoutUrl = (url: string): 'success' | 'fail' | 'other' => {
    if (url.includes('/api/payments/success') || url.includes('payment-success')) return 'success';
    if (
      url.includes('/api/payments/cancel') ||
      url.includes('/api/payments/failure') ||
      url.includes('payment-failure') ||
      url.includes('payment-cancel')
    ) {
      return 'fail';
    }
    return 'other';
  };

  const handleCheckoutOutcome = (url: string) => {
    const kind = classifyCheckoutUrl(url);
    if (kind === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setState('success');
      return true;
    }
    if (kind === 'fail') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFailed(reasonFromUrl(url));
      return true;
    }
    return false;
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    handleCheckoutOutcome(navState.url ?? '');
  };

  const handleRetry = () => {
    setFailReason('');
    setState('loading');
    setWebviewKey((k) => k + 1);
  };

  const handleSuccessContinue = () => {
    if (jobId) {
      router.replace({ pathname: '/job-tracking', params: { id: jobId, paid: '1' } });
      return;
    }
    router.replace('/(customer)/(tabs)');
  };

  const handleClose = () => {
    if (state === 'success') {
      handleSuccessContinue();
      return;
    }
    Alert.alert(t('payment'), t('paymentRequiredAlert'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('close'),
        style: 'destructive',
        onPress: () => {
          if (router.canGoBack()) router.back();
          else router.replace('/(customer)/(tabs)');
        },
      },
    ]);
  };

  if (state === 'success') {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{ flex: 1, backgroundColor: '#0D1117' }}
      >
        <LinearGradient
          colors={['#052E16', '#0D1117', '#0D1117']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
        >
          <Animated.View entering={FadeInUp.delay(100).duration(500).springify()}>
            <View style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: 'rgba(16,185,129,0.15)',
              borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 28, alignSelf: 'center',
            }}>
              <CheckCircle2 size={48} color="#10B981" />
            </View>

            <Text style={{
              color: '#F8FAFC', fontSize: 26, fontWeight: '800',
              textAlign: 'center', marginBottom: 10,
            }}>
              תשלום בוצע בהצלחה
            </Text>
            <Text style={{
              color: '#34D399', fontSize: 18, fontWeight: '700',
              textAlign: 'center', marginBottom: 10,
            }}>
              {extraId ? 'תשלום נוסף על תיקון נוסף התקבל' : 'טכנאי בדרך אליך'}
            </Text>
            <Text style={{
              color: '#64748B', fontSize: 15, textAlign: 'center', lineHeight: 22,
            }}>
              ₪{amountNum.toLocaleString()} שולמו
            </Text>

            <Pressable
              onPress={handleSuccessContinue}
              style={({ pressed }) => [doneGlass.btn, pressed && { opacity: 0.88 }]}
            >
              {Platform.OS === 'ios' ? (
                <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, doneGlass.androidBg]} />
              )}
              <LinearGradient
                colors={[
                  'rgba(52,211,153,0.55)',
                  'rgba(16,185,129,0.72)',
                  'rgba(5,150,105,0.85)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(255,255,255,0.4)', 'transparent']}
                style={doneGlass.sheen}
              />
              <Text style={doneGlass.label}>{t('done')}</Text>
              <View style={doneGlass.border} pointerEvents="none" />
            </Pressable>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    );
  }

  if (state === 'failed') {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1, backgroundColor: '#0D1117' }}>
        <LinearGradient
          colors={['#1C0A0A', '#0D1117', '#0D1117']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
        >
          <View style={{
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: 'rgba(239,68,68,0.12)',
            borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 28, alignSelf: 'center',
          }}>
            <XCircle size={48} color="#EF4444" />
          </View>

          <Text style={{
            color: '#F8FAFC', fontSize: 26, fontWeight: '800',
            textAlign: 'center', marginBottom: 10,
          }}>
            התשלום לא הצליח
          </Text>
          <Text style={{
            color: '#FCA5A5', fontSize: 15, textAlign: 'center', lineHeight: 22,
            marginBottom: 8, paddingHorizontal: 8,
          }}>
            {failReason || 'לא הצלחנו לעבד את התשלום. אנא נסה שנית'}
          </Text>
          <Text style={{
            color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20,
          }}>
            אפשר לנסות שוב או לבטל
          </Text>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 40 }}>
            <Pressable onPress={handleClose} style={{
              flex: 1, paddingVertical: 16, borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 15 }}>ביטול</Text>
            </Pressable>

            <Pressable onPress={handleRetry} style={{ flex: 2 }}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 16, paddingVertical: 16,
                  alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 8,
                }}
              >
                <RefreshCw size={17} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>נסה שנית</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingBottom: 16,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Pressable
            onPress={handleClose}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} color="#64748B" />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} color={isMockCheckout ? '#D97706' : '#10B981'} />
            <Text style={{ color: isMockCheckout ? '#D97706' : '#10B981', fontSize: 12, fontWeight: '600' }}>
              {isMockCheckout ? 'תשלום לדוגמה' : 'תשלום מאובטח'}
            </Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        {/* Amount display */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>
            {description ?? 'תשלום עבור תיקון אופניים'}
          </Text>
          <Text style={{ color: '#0F172A', fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>
            ₪{amountNum.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* WebView */}
      <View style={{ flex: 1 }}>
        {!/^https?:\/\//i.test(paymentUrl) ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={{ color: '#94A3B8', fontSize: 14 }}>מכין דף תשלום…</Text>
          </View>
        ) : (
          <WebView
            key={webviewKey}
            ref={webviewRef}
            source={{ uri: paymentUrl }}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(req) => !handleCheckoutOutcome(req.url ?? '')}
            onNavigationStateChange={handleNavigationChange}
            onLoadEnd={() => {
              setState((s) => (s === 'success' || s === 'failed' ? s : 'ready'));
            }}
            onError={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setFailed('שגיאה בטעינת דף התשלום. בדוק חיבור לאינטרנט ונסה שנית');
            }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#F8FAFC',
              }}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 12 }}>
                  טוען דף תשלום…
                </Text>
              </View>
            )}
            style={{ flex: 1 }}
          />
        )}
      </View>

      {/* Processing overlay */}
      {state === 'processing' && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <View style={{
            backgroundColor: '#fff', borderRadius: 24,
            padding: 32, alignItems: 'center', gap: 16,
            marginHorizontal: 40,
          }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 16 }}>
              מעבד תשלום…
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const doneGlass = StyleSheet.create({
  btn: {
    marginTop: 40,
    alignSelf: 'center',
    minWidth: 200,
    minHeight: 56,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 44,
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  androidBg: {
    backgroundColor: 'rgba(6, 78, 59, 0.75)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 243, 208, 0.55)',
  },
});

export default function PaymentRoute() {
  return (
    <RequireAuth>
      <ErrorBoundary>
<PaymentScreen />
      </ErrorBoundary>
    </RequireAuth>
  );
}
