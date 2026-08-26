import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth/use-session';

/**
 * Protects customer flow screens. Does NOT treat a transient null session
 * (refetch / network blip / Render cold start) as logout — only redirects
 * after the query has settled without a user.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending, isFetching, isError, isFetched } = useSession();
  const hadUserRef = useRef(false);

  if (session?.user) {
    hadUserRef.current = true;
  }

  const hasUser = !!session?.user;
  // Settled "no user" only after a successful fetch that returned null,
  // not while loading/refetching or after a failed getSession.
  const confirmedLoggedOut =
    isFetched && !isPending && !isFetching && !isError && !hasUser;

  useEffect(() => {
    if (confirmedLoggedOut) {
      router.replace('/sign-in');
    }
  }, [confirmedLoggedOut, router]);

  // Still establishing session, or temporary gap while we know they were logged in
  if (isPending || (isFetching && !hasUser) || (isError && hadUserRef.current && !hasUser)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!hasUser) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <>{children}</>;
}
