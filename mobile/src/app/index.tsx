import React, { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth/use-session';
import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import { hasSeenWelcome } from '@/lib/welcome-storage';

type MeResponse = {
  user: {
    role: string;
    isApproved: boolean;
    isAdmin: boolean;
  };
};

export default function Index() {
  const { data: session, isLoading: sessionLoading, isFetching: sessionFetching } = useSession();
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [seenWelcome, setSeenWelcome] = useState(true);

  useEffect(() => {
    if (session?.user) {
      setWelcomeChecked(true);
      return;
    }
    hasSeenWelcome()
      .then((seen) => {
        setSeenWelcome(seen);
        setWelcomeChecked(true);
      })
      .catch(() => setWelcomeChecked(true));
  }, [session?.user]);

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/api/me'),
    enabled: !!session?.user,
    staleTime: 1000 * 60 * 5,
  });

  if (
    sessionLoading ||
    (sessionFetching && !session?.user) ||
    !welcomeChecked ||
    (session?.user && meLoading)
  ) {
    return null;
  }

  if (session?.user && meData?.user) {
    const { role, isApproved, isAdmin } = meData.user;

    if (role === 'technician') {
      if (isApproved || isAdmin) {
        return <Redirect href="/(technician)/(tabs)" />;
      }
      return <Redirect href="/technician-pending" />;
    }

    // customer, pending, or unknown — all users register as customers
    return <Redirect href="/(customer)/(tabs)" />;
  }

  return <Redirect href={seenWelcome ? '/sign-in' : '/welcome'} />;
}