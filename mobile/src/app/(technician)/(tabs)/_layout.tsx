import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { LayoutDashboard, Briefcase, DollarSign, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguageStore, useTechnicianStore, useAppThemeStore } from '@/lib/store';
import { getThemeColors } from '@/lib/theme-colors';
import { api } from '@/lib/api/api';
import { TechnicianProfile } from '@/lib/types';

export default function TechnicianTabLayout() {
  const t = useLanguageStore((s) => s.t);
  const insets = useSafeAreaInsets();
  const colorScheme = useAppThemeStore((s) => s.colorScheme);
  const colors = getThemeColors(colorScheme);
  const setProfile = useTechnicianStore((s) => s.setProfile);

  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [isApproved, setIsApproved] = React.useState<boolean | null>(null);
  const [roleChecked, setRoleChecked] = React.useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const me = await api.get<{
          user: {
            id: string;
            name: string;
            email: string;
            image?: string;
            role: string;
            isApproved: boolean;
          };
        }>('/api/me');

        const user = me.user;
        setUserRole(user.role ?? null);
        setIsApproved(user.isApproved);

        if (user.role !== 'technician') {
          setRoleChecked(true);
          return;
        }

        if (!user.isApproved) {
          setRoleChecked(true);
          return;
        }

        let techData: any = null;
        try {
          const techRes = await api.get<{ technician: any }>(`/api/technicians/${user.id}`);
          techData = techRes.technician;
        } catch {
          // partial profile ok
        }

        const profile: TechnicianProfile = {
          id: user.id,
          name: user.name || '',
          email: user.email || '',
          avatar_url: user.image || techData?.image || '',
          phone: techData?.phone ?? '',
          role: 'technician',
          rating: techData?.rating ?? 0,
          total_reviews: techData?.totalReviews ?? 0,
          total_earnings: 0,
          bio: techData?.bio ?? '',
          vehicle_type: techData?.vehicleType ?? '',
          service_radius: techData?.serviceRadius ?? 40,
          base_price: techData?.basePrice ?? 0,
          is_available: techData?.isAvailable ?? false,
          verification_status: user.isApproved ? 'verified' : 'pending',
          current_location:
            techData?.currentLocationLat && techData?.currentLocationLng
              ? { latitude: techData.currentLocationLat, longitude: techData.currentLocationLng }
              : undefined,
          created_at: techData?.createdAt ?? new Date().toISOString(),
          updated_at: techData?.updatedAt ?? new Date().toISOString(),
        };

        setProfile(profile);
        setRoleChecked(true);
      } catch (error) {
        console.error('Error loading technician profile:', error);
        setRoleChecked(true);
      }
    };

    loadProfile();
  }, [setProfile]);

  if (!roleChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (userRole === 'customer' || userRole === 'pending' || !userRole) {
    return <Redirect href="/(customer)/(tabs)" />;
  }

  if (userRole === 'technician' && isApproved === false) {
    return <Redirect href="/technician-pending" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.tabBarBorder,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 56 + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard'),
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t('jobs'),
          tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t('earnings'),
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="admin" options={{ href: null }} />
    </Tabs>
  );
}