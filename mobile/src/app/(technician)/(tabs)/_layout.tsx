import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { LayoutDashboard, Briefcase, DollarSign, User, ShieldCheck } from 'lucide-react-native';
import { useLanguageStore, useTechnicianStore } from '@/lib/store';
import { authClient } from '@/lib/auth/auth-client';

const ADMIN_EMAILS = ['maortest@ebikeland.com', 'ebikelandapp@gmail.com'];

export default function TechnicianTabLayout() {
  const t = useLanguageStore((s) => s.t);
  const setProfile = useTechnicianStore((s) => s.setProfile);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [roleChecked, setRoleChecked] = React.useState(false);

  // Load technician profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const session = await authClient.getSession();
        if (session?.data?.user) {
          const user = session.data.user as any;
          setUserRole(user.role ?? null);
          setIsAdmin(ADMIN_EMAILS.includes(user.email));
          if (user.role !== 'technician' && !ADMIN_EMAILS.includes(user.email)) {
            setRoleChecked(true);
            return;
          }
          setProfile({
            id: user.id,
            name: user.name || '',
            email: user.email || '',
            avatar_url: user.image || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
            phone: '',
            role: 'technician',
            rating: 4.8,
            total_reviews: 0,
            total_earnings: 0,
            bio: '',
            vehicle_type: 'אופניים חשמליים',
            service_radius: 10,
            base_price: 100,
            is_available: false,
            verification_status: 'verified',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setRoleChecked(true);
        }
      } catch (error) {
        console.error('Error loading technician profile:', error);
        setRoleChecked(true);
      }
    };

    loadProfile();
  }, []);

  // Block render until role is confirmed — prevents dashboard from mounting
  // with a customer token and firing 401/403 API calls before redirect completes
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
