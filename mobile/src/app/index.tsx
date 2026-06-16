import React from 'react';
import { useSession } from '@/lib/auth/use-session';
import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/api';

type MeResponse = {
  user: {
    role: string;
    isApproved: boolean;
    isAdmin: boolean;
  };
};

export default function Index() {
  const { data: session, isLoading: sessionLoading } = useSession();

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/api/me'),
    enabled: !!session?.user,
    staleTime: 1000 * 60 * 5,
  });

  if (sessionLoading || (session?.user && meLoading)) {
    return null;
  }

  if (session?.user && meData?.user) {
    const { role, isApproved, isAdmin } = meData.user;

    if (role === 'pending' || !role) {
      return <Redirect href="/role-select" />;
    }
    if ((role === 'technician' && isApproved) || isAdmin) {
      return <Redirect href="/(technician)/(tabs)" />;
    }
    return <Redirect href="/(customer)/(tabs)" />;
  }

  return <Redirect href="/sign-in" />;
}
