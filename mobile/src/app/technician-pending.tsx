import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSignOut } from '@/lib/auth/use-session';

export default function TechnicianPendingScreen() {
  const router = useRouter();
  const signOut = useSignOut();
  const [checking, setChecking] = useState(false);

  const checkApproval = useCallback(async (manual = false) => {
    if (manual) {
      Haptics.selectionAsync();
      setChecking(true);
    }
    try {
      const me = await api.get<{ user: { role: string; isApproved: boolean; isAdmin?: boolean } }>('/api/me');
      const { role, isApproved, isAdmin } = me.user;
      if (role === 'customer') {
        router.replace('/(customer)/(tabs)');
        return;
      }
      if (isApproved || isAdmin) {
        router.replace('/(technician)/(tabs)');
      }
    } catch {
      // stay on screen
    } finally {
      if (manual) setChecking(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      checkApproval(false);
      const interval = setInterval(() => checkApproval(false), 15000);
      return () => clearInterval(interval);
    }, [checkApproval])
  );

  const handleSignOut = async () => {
    Haptics.selectionAsync();
    await signOut();
    router.replace('/sign-in');
  };

  return (
    <LinearGradient colors={['#f0fdf4', '#dcfce7']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: '#FEF3C7',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <Clock size={44} color="#D97706" />
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' }}>
            ממתין לאישור מנהל
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: '#4B5563',
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 24,
              paddingHorizontal: 8,
            }}
          >
            נרשמת כטכנאי. חשבונך יופעל לאחר שמנהל המערכת יאשר אותך.{'\n'}
            תקבל גישה ללוח הבקרה מיד לאחר האישור.
          </Text>

          <Pressable
            onPress={() => checkApproval(true)}
            disabled={checking}
            style={{ marginTop: 32, width: '100%' }}
          >
            <LinearGradient
              colors={checking ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
              style={{
                borderRadius: 16,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {checking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <RefreshCw size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>בדוק שוב אם אושרתי</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={handleSignOut} style={{ marginTop: 20, padding: 12 }}>
            <Text style={{ color: '#6B7280', fontSize: 15 }}>התנתק</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}