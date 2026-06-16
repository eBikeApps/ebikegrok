import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';
import { X, ShieldCheck, CheckCircle2, XCircle, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { authClient } from '@/lib/auth/auth-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

type PaymentState = 'loading' | 'ready' | 'processing' | 'success' | 'failed';

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jobId, paymentUrl, amount, description } = useLocalSearchParams<{
    jobId: string;
    paymentUrl: string;
    amount: string;
    description?: string;
  }>();

  const [state, setState] = useState<PaymentState>('loading');
  const [webviewKey, setWebviewKey] = useState(0);
  const webviewRef = useRef<WebView>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Polling fallback: if Grow's redirect URL changes, we still catch the payment
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

  const handleNavigationChange = (navState: WebViewNavigation) => {
    const url = navState.url ?? '';
    if (url.includes('/api/payments/success') || url.includes('payment-success')) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState('success');
    } else if (url.includes('/api/payments/cancel') || url.includes('/api/payments/failure') || url.includes('payment-failure') || url.includes('payment-cancel')) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setState('failed');
    }
  };

  const handleRetry = () => {
    setState('loading');
    setWebviewKey((k) => k + 1);
  };

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(customer)/(tabs)');
  };

  const handleSuccessContinue = () => {
    router.replace({ pathname: '/job-tracking', params: { id: jobId } });
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
              color: '#F8FAFC', fontSize: 28, fontWeight: '800',
              textAlign: 'center', marginBottom: 10,
            }}>
              התשלום התקבל!
            </Text>
            <Text style={{
              color: '#64748B', fontSize: 15, textAlign: 'center', lineHeight: 22,
            }}>
              ₪{amountNum.toLocaleString()} שולמו בהצלחה{'\n'}הטכנאי בדרך אליך
            </Text>

            <Pressable
              onPress={handleSuccessContinue}
              style={{ marginTop: 40 }}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 18, paddingVertical: 17,
                  paddingHorizontal: 40, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
                  מעקב אחר הטכנאי
                </Text>
              </LinearGradient>
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
            התשלום נכשל
          </Text>
          <Text style={{
            color: '#64748B', fontSize: 15, textAlign: 'center', lineHeight: 22,
          }}>
            לא הצלחנו לעבד את התשלום{'\n'}אנא נסה שנית
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
            <ShieldCheck size={14} color="#10B981" />
            <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>תשלום מאובטח</Text>
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
        {!paymentUrl ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={{ color: '#94A3B8', fontSize: 14 }}>מכין דף תשלום…</Text>
          </View>
        ) : (
          <WebView
            key={webviewKey}
            ref={webviewRef}
            source={{ uri: paymentUrl }}
            onNavigationStateChange={handleNavigationChange}
            onLoadStart={() => setState('loading')}
            onLoadEnd={() => setState('ready')}
            onError={() => setState('failed')}
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
