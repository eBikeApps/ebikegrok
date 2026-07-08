import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth/use-session';

/** Redirects unauthenticated users to sign-in before customer flow screens. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading && !session?.user) {
      router.replace('/sign-in');
    }
  }, [isLoading, session?.user, router]);

  if (isLoading || !session?.user) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <>{children}</>;
}