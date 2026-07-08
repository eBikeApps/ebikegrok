import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useAppThemeStore } from '@/lib/store';
import { getThemeColors } from '@/lib/theme-colors';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { KeyboardDoneToolbar } from '@/components/KeyboardDoneToolbar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nManager } from 'react-native';
import { useEffect, useState } from 'react';
import { applyRtlForLanguage, readStoredLanguage } from '@/lib/rtl';
import { useSession } from '@/lib/auth/use-session';
import { clearCustomerActiveJobState } from '@/lib/active-job-sync';
import { handlePushNotificationNavigation } from '@/lib/push-navigation';
import * as Notifications from 'expo-notifications';
import { preloadSystemSounds, playSystemSound } from '@/lib/system-sounds';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingScreen } from '@/components/LoadingScreen';

import '../../global.css';

// Default RTL for Hebrew until persisted language is loaded
applyRtlForLanguage('he');

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// React Query focus manager for React Native — resumes intervals when app comes to foreground
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

function RootLayoutNav() {
  const colorScheme = useAppThemeStore((s) => s.colorScheme);
  const { data: session, isLoading } = useSession();
  const router = useRouter();
  const [rtlReady, setRtlReady] = useState(false);

  useEffect(() => {
    readStoredLanguage()
      .then((lang) => {
        applyRtlForLanguage(lang);
      })
      .finally(() => setRtlReady(true));
  }, []);

  useEffect(() => {
    if (!rtlReady) return;
    // Hide splash screen after layout is ready
    SplashScreen.hideAsync();
    // Pre-warm system sound players so the first play has no latency
    preloadSystemSounds();
  }, [rtlReady]);

  // Play sound on incoming notifications + listen for notification taps
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      playSystemSound('notification');
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as {
        jobId?: string;
        screen?: string;
        invitationId?: string;
      };
      await handlePushNotificationNavigation(router, data);
    });
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  // Drop stale in-memory active job on cold start / re-login (store is not persisted)
  useEffect(() => {
    if (session?.user) {
      clearCustomerActiveJobState();
    }
  }, [session?.user?.id]);

  // Show loading screen while session loads (replaces black screen on production launch)
  if (!rtlReady || isLoading) return <LoadingScreen />;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="technician-pending" options={{ gestureEnabled: false }} />
        <Stack.Screen name="legal" options={{ presentation: 'card' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="saved-addresses" options={{ presentation: 'card' }} />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(technician)" />
        <Stack.Screen
          name="repair-request"
          options={{ presentation: 'card', gestureEnabled: true }}
        />
        <Stack.Screen
          name="technician-select"
          options={{ presentation: 'card', gestureEnabled: true }}
        />
        <Stack.Screen
          name="job-tracking"
          options={{ presentation: 'card', gestureEnabled: false }}
        />
        <Stack.Screen
          name="job-complete"
          options={{ presentation: 'modal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="technician-profile"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="payment"
          options={{ presentation: 'modal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="withdrawal-request"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        {/* <Stack.Screen name="modal" options={{ presentation: 'modal' }} /> */}
        {/* Warning: modal.tsx is a template stub — implement before publishing if you want the feature */}
        <Stack.Screen
          name="chat"
          options={{ presentation: 'card', gestureEnabled: true }}
        />
        <Stack.Screen
          name="order-details"
          options={{ presentation: 'card', gestureEnabled: true }}
        />
        <Stack.Screen
          name="reviews"
          options={{ presentation: 'card', gestureEnabled: true }}
        />
        <Stack.Screen
          name="submit-review"
          options={{ presentation: 'card', gestureEnabled: true }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useAppThemeStore((s) => s.colorScheme);
  const themeColors = getThemeColors(colorScheme);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <KeyboardProvider>
              <StatusBar style={themeColors.statusBar} />
              <RootLayoutNav />
              <KeyboardDoneToolbar />
            </KeyboardProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
