import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { LayoutDashboard, Briefcase, DollarSign, User, ShieldCheck } from 'lucide-react-native';
import { useLanguageStore, useTechnicianStore } from '@/lib/store';
import { api } from '@/lib/api/api';
import { TechnicianProfile } from '@/lib/types';

const ADMIN_EMAILS = ['maortest@ebikeland.com', 'ebikelandapp@gmail.com'];

export default function TechnicianTabLayout() {
  const t = useLanguageStore((s) => s.t);
  const setProfile = useTechnicianStore((s) => s.setProfile);
  const [isAdmin, setIsAdmin] = React.useState(false);
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
            isAdmin?: boolean;
          };
        }>('/api/me');

        const user = me.user;
        setUserRole(user.role ?? null);
        setIsApproved(user.isApproved);
        setIsAdmin(!!user.isAdmin || ADMIN_EMAILS.includes(user.email));

        if (user.role !== 'technician' && !ADMIN_EMAILS.includes(user.email)) {
          setRoleChecked(true);
          return;
        }

        if (!user.isApproved && !user.isAdmin && !ADMIN_EMAILS.includes(user.email)) {
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (userRole === 'customer') {
    return <Redirect href="/(customer)/(tabs)" />;
  }

  if (userRole === 'technician' && isApproved === false && !isAdmin) {
    return <Redirect href="/technician-pending" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingTop: 12,
          paddingBottom: 20,
          height: 85,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard'),
          tabBarIcon: ({ color }) => <LayoutDashboard size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t('jobs'),
          tabBarIcon: ({ color }) => <Briefcase size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t('earnings'),
          tabBarIcon: ({ color }) => <DollarSign size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color }) => <User size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: isAdmin ? undefined : null,
          title: 'ניהול',
          tabBarIcon: ({ color }) => <ShieldCheck size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}