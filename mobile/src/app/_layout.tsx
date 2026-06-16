import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nManager } from 'react-native';
import { useEffect } from 'react';
import { useSession } from '@/lib/auth/use-session';
import * as Notifications from 'expo-notifications';
import { preloadSystemSounds, playSystemSound } from '@/lib/system-sounds';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingScreen } from '@/components/LoadingScreen';

import '../../global.css';

// Force RTL for Hebrew
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// React Query focus manager for React Native — resumes intervals when app comes to foreground
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  const { data: session, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Hide splash screen after layout is ready
    SplashScreen.hideAsync();
    // Pre-warm system sound players so the first play has no latency
    preloadSystemSounds();
  }, []);

  // Play sound on incoming notifications + listen for notification taps
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      playSystemSound('notification');
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { jobId?: string; screen?: string };
      if (data?.screen === 'job-tracking' && data?.jobId) {
        // Slice 3: standardize to 'id' so job-tracking polling/hydrate works reliably (post-pay, restart, notif deep links)
        router.push({ pathname: '/job-tracking', params: { id: data.jobId } });
      }
    });
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  // Show loading screen while session loads (replaces black screen on production launch)
  if (isLoading) return <LoadingScreen />;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="role-select" />
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
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <KeyboardProvider>
              <StatusBar style="light" />
              <RootLayoutNav colorScheme={colorScheme} />
            </KeyboardProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
