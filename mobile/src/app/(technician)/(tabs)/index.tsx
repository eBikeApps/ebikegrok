import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, Switch, ScrollView, RefreshControl, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import Animated, { FadeInUp, FadeIn, FadeInRight, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { Star, MapPin, Briefcase, DollarSign, Check, Wrench, RefreshCw, Bell, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useLanguageStore, useTechnicianStore, useLocationStore } from '@/lib/store';
import { Job, Location as LocationType } from '@/lib/types';
import { cn } from '@/lib/cn';
import { authClient } from '@/lib/auth/auth-client';
import { useSession } from '@/lib/auth/use-session';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { playSystemSound } from '@/lib/system-sounds';

export default function TechnicianDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);

  const { data: session } = useSession();
  const user = session?.user;

  const profile = useTechnicianStore((s) => s.profile);
  const isAvailable = useTechnicianStore((s) => s.isAvailable);
  const displayName = user?.name ?? profile?.name;
  const displayAvatar = user?.image ?? profile?.avatar_url;
  const setIsAvailable = useTechnicianStore((s) => s.setIsAvailable);
  const addActiveJob = useTechnicianStore((s) => s.addActiveJob);

  const currentLocation = useLocationStore((s) => s.currentLocation);
  const setCurrentLocation = useLocationStore((s) => s.setCurrentLocation);
  const setLocationPermission = useLocationStore((s) => s.setLocationPermission);

  const [stats, setStats] = useState({ todaysJobs: 0, todaysEarnings: 0, weeklyJobs: 0, rating: profile?.rating ?? 4.8 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newOrderBanner, setNewOrderBanner] = useState<string | null>(null);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

  // Track seen job IDs to avoid duplicate notifications
  const seenJobIds = useRef<Set<string>>(new Set());
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cachedToken = useRef<string | null>(null);
  const isFetchingJobs = useRef(false);
  const initialLoadDone = useRef(false);
  const hasCheckedActiveJob = useRef(false);

  useEffect(() => { registerForPushNotifications(); }, []);

  useEffect(() => {
    if (isAvailable) {
      requestLocationPermission();
      const locationInterval = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({});
          const newLocation = { latitude: location.coords.latitude, longitude: location.coords.longitude };
          setCurrentLocation(newLocation);
          await updateLocationInBackend(newLocation);
        } catch (err) {
          console.warn('[Location] Failed to update technician location:', err);
        }
      }, 30000);
      return () => clearInterval(locationInterval);
    }
  }, [isAvailable]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const sessionResult = await authClient.getSession();
        if (!sessionResult?.data?.session) { setStatsLoading(false); return; }
        if ((sessionResult.data.user as any)?.role !== 'technician') { setStatsLoading(false); return; }
        const token = sessionResult.data.session.token;
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/technician/stats`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setStats({ todaysJobs: data.todaysJobs || 0, todaysEarnings: data.todaysEarnings || 0, weeklyJobs: data.weeklyJobs || 0, rating: data.rating || 4.8 });
        }
      } catch {} finally { setStatsLoading(false); }
    };
    fetchStats();
  }, []);

  const mapJob = (j: any): Job => ({
    id: j.id,
    customer_id: j.customerId,
    technician_id: j.technicianId,
    status: j.status,
    photo_url: j.photoUrl,
    description: j.description,
    bike_type: j.bikeType,
    categories: j.category?.split(', ').filter(Boolean) ?? [],
    estimated_price_min: j.estimatedPriceMin,
    estimated_price_max: j.estimatedPriceMax,
    customer_location: { latitude: j.customerLocationLat, longitude: j.customerLocationLng, address: j.customerAddress || undefined },
    created_at: j.createdAt,
    customer: j.customer ? {
      id: j.customer.id, name: j.customer.name, email: j.customer.email,
      phone: j.customer.phone || '',
      avatar_url: j.customer.image || '', role: 'customer' as const,
      saved_addresses: [], created_at: j.customer.createdAt, updated_at: j.customer.createdAt,
    } : undefined,
  });

  // Single polling function — Bearer token, 3-second interval
  const fetchPendingJobs = useCallback(async (isRefresh = false) => {
    if (isFetchingJobs.current && !isRefresh) return;
    isFetchingJobs.current = true;
    try {
      if (isRefresh) setRefreshing(true);
      // Only show loading spinner on the very first fetch, not on background polls
      else if (!initialLoadDone.current) setJobsLoading(true);

      // Use cached token; only fetch a new session if we don't have one yet
      if (!cachedToken.current) {
        const sessionResult = await authClient.getSession();
        if (!sessionResult?.data?.session) return;
        cachedToken.current = sessionResult.data.session.token;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs`, {
        headers: { 'Authorization': `Bearer ${cachedToken.current}` },
      });

      if (response.status === 401) {
        // Token expired — clear cache and retry next tick
        cachedToken.current = null;
        return;
      }
      if (!response.ok) { return; }
      const data = await response.json();

      const mapped: Job[] = (data.jobs || [])
        .filter((j: any) => j.status === 'pending')
        .map(mapJob);

      // Show banner for any new jobs not seen before.
      // Skip the first batch (initial load) so we don't ding for already-existing jobs.
      mapped.forEach((job) => {
        if (!seenJobIds.current.has(job.id)) {
          seenJobIds.current.add(job.id);
          if (initialLoadDone.current) {
            const name = job.customer?.name?.split(' ')[0] ?? 'לקוח';
            playSystemSound('new_job');
            setNewOrderBanner(name);
            if (bannerTimer.current) clearTimeout(bannerTimer.current);
            bannerTimer.current = setTimeout(() => setNewOrderBanner(null), 4000);
          }
        }
      });

      // Only update state if the job list actually changed (avoids re-render interrupting user interaction)
      setPendingJobs((prev) => {
        const prevIds = prev.map((j) => j.id).join(',');
        const newIds = mapped.map((j) => j.id).join(',');
        return prevIds === newIds ? prev : mapped;
      });
      initialLoadDone.current = true;
    } catch {} finally { isFetchingJobs.current = false; setJobsLoading(false); setRefreshing(false); }
  }, []);

  // Seed token cache whenever session changes + recover active job after crash
  useEffect(() => {
    if (session?.session?.token) {
      cachedToken.current = session.session.token;
    }
    if (!session?.user) return;

    fetchPendingJobs();

    // Once per mount: check if technician has an in-progress job they were navigated away from
    if (hasCheckedActiveJob.current) return;
    hasCheckedActiveJob.current = true;

    const recoverActiveJob = async () => {
      try {
        const token = session.session?.token;
        if (!token) return;
        const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const activeStatuses = ['accepted', 'on_way', 'arrived', 'in_progress'];
        const activeJob = (data.jobs || []).find(
          (j: any) => activeStatuses.includes(j.status) && j.technicianId === session.user?.id
        );
        if (activeJob) {
          router.push({ pathname: '/(technician)/active-job', params: { id: activeJob.id } });
        }
      } catch { /* silent */ }
    };
    recoverActiveJob();
  }, [session?.user]);

  // Polling loop — 5s when available (was 3s; saves battery while still feeling responsive)
  useEffect(() => {
    if (!isAvailable) return;
    const interval = setInterval(() => fetchPendingJobs(), 5000);
    return () => clearInterval(interval);
  }, [isAvailable, fetchPendingJobs]);

  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

  const sendHeartbeat = useCallback(async () => {
    try {
      if (!cachedToken.current) return;
      if ((user as any)?.role !== 'technician') return;
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/technicians/heartbeat`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${cachedToken.current}` },
      });
    } catch { /* silent */ }
  }, [user]);

  // AppState heartbeat: keep lastSeenAt fresh while app is open
  useEffect(() => {
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const startHeartbeat = () => {
      sendHeartbeat();
      heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000); // every 2 min
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
    };

    // Start immediately (app is active when this mounts)
    startHeartbeat();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') startHeartbeat();
      else stopHeartbeat();
    });

    return () => { stopHeartbeat(); subscription.remove(); };
  }, [sendHeartbeat]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted' ? 'granted' : 'denied');
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const newLocation = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setCurrentLocation(newLocation);
        await updateLocationInBackend(newLocation);
      }
    } catch {}
  };

  const updateLocationInBackend = async (location: LocationType) => {
    try {
      const sessionResult = await authClient.getSession();
      if (!sessionResult?.data?.session) return;
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/technicians/location`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${sessionResult.data.session.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.latitude, lng: location.longitude }),
      });
    } catch {}
  };

  const handleToggleAvailability = async (value: boolean) => {
    playSystemSound(value ? 'success' : 'click');
    setIsAvailable(value);
    try {
      const sessionResult = await authClient.getSession();
      if (!sessionResult?.data?.session) return;
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/technicians/availability`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${sessionResult.data.session.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: value }),
      });
    } catch {}
  };

  const handleAcceptJob = async (job: Job) => {
    playSystemSound('complete');
    setAcceptingJobId(job.id);
    try {
      const sessionResult = await authClient.getSession();
      if (!sessionResult?.data?.session) return;
      const token = sessionResult.data.session.token;
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('Failed to accept job:', response.status, text);
        let serverMsg: string | undefined;
        try { serverMsg = JSON.parse(text)?.message; } catch {}
        playSystemSound('error');
        // Job was probably cancelled by the customer — remove from list and notify
        if (serverMsg && (serverMsg.includes('cancelled') || serverMsg.includes('בוטל'))) {
          setPendingJobs((prev) => prev.filter((j) => j.id !== job.id));
          setErrorModal({ visible: true, title: t('jobCancelledTitle'), message: t('jobCancelledMsg') });
        } else if (response.status === 409 || (serverMsg && (serverMsg.includes('נלקחה') || serverMsg.includes('taken') || serverMsg.includes('already')))) {
          // Slice 4 / T02: better UX for the race where another tech took it (backend S02 atomic claim)
          setPendingJobs((prev) => prev.filter((j) => j.id !== job.id));
          setErrorModal({ visible: true, title: t('error'), message: serverMsg || (language === 'he' ? 'העבודה כבר נלקחה על ידי טכנאי אחר' : 'Job already taken by another technician') });
        } else {
          setErrorModal({ visible: true, title: t('error'), message: serverMsg || t('failedToAcceptJob') });
          fetchPendingJobs();
        }
        return;
      }
      const acceptedJob: Job = {
        ...job, status: 'accepted',
        technician_id: user?.id, accepted_at: new Date().toISOString(),
        technician_location: currentLocation ?? undefined,
      };
      addActiveJob(acceptedJob);
      setPendingJobs((prev) => prev.filter((j) => j.id !== job.id));
      router.push({ pathname: '/(technician)/active-job', params: { id: acceptedJob.id } });
    } catch (error) {
      playSystemSound('error');
      setErrorModal({ visible: true, title: t('error'), message: t('connectionError') });
    }
    finally { setAcceptingJobId(null); }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (language === 'he') {
      if (diffMin < 1) return 'עכשיו';
      if (diffMin < 60) return `לפני ${diffMin} דק'`;
      return `לפני ${Math.floor(diffMin / 60)} שע'`;
    } else {
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      return `${Math.floor(diffMin / 60)}h ago`;
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-white border-b border-gray-100">
        <View className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Image
                source={{ uri: displayAvatar }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
                contentFit="cover"
              />
              <View className="ml-3">
                <Text className="text-gray-900 font-bold text-lg">{displayName}</Text>
                <View className="flex-row items-center">
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text className="text-gray-600 text-sm ml-1">{stats.rating}</Text>
                </View>
              </View>
            </View>
            <View className="items-center">
              <Switch
                value={isAvailable}
                onValueChange={handleToggleAvailability}
                trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
                thumbColor={isAvailable ? '#10B981' : '#EF4444'}
                style={{ transform: [{ scaleX: 1.4 }, { scaleY: 1.4 }] }}
              />
              <Text className={cn('text-sm font-bold mt-1', isAvailable ? 'text-green-600' : 'text-red-500')}>
                {isAvailable ? t('available') : t('unavailable')}
              </Text>
            </View>
          </View>
          {isAvailable && (
            <Animated.View entering={FadeIn.duration(200)} className="mt-3 bg-green-50 rounded-xl px-4 py-2 flex-row items-center">
              <MapPin size={16} color="#10B981" />
              <Text className="text-green-700 text-sm ml-2">{t('locationActive')}</Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* New Order Banner Notification */}
      {newOrderBanner && (
        <Animated.View
          entering={SlideInUp.springify().damping(16)}
          exiting={SlideOutUp.duration(250)}
          style={{
            position: 'absolute',
            top: insets.top + 80,
            left: 16,
            right: 16,
            zIndex: 100,
          }}
        >
          <View
            style={{
              backgroundColor: '#1C1C1E',
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 18,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#FF9F0A',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 12,
              }}
            >
              <Bell size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('newRequest')}</Text>
              <Text style={{ color: '#EBEBF599', fontSize: 13, marginTop: 1 }}>
                {newOrderBanner} {t('sentServiceRequest')}
              </Text>
            </View>
            <Pressable onPress={() => setNewOrderBanner(null)} style={{ padding: 4 }}>
              <Text style={{ color: '#EBEBF599', fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPendingJobs(true)}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Stats Grid */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} className="px-4 pt-4">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm shadow-black/5">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mb-2">
                <Briefcase size={20} color="#3B82F6" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">{stats.todaysJobs}</Text>
              <Text className="text-gray-500 text-sm">{t('todaysJobs')}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm shadow-black/5">
              <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mb-2">
                <DollarSign size={20} color="#10B981" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">₪{stats.todaysEarnings}</Text>
              <Text className="text-gray-500 text-sm">{t('todaysEarnings')}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm shadow-black/5">
              <View className="w-10 h-10 bg-yellow-100 rounded-full items-center justify-center mb-2">
                <Star size={20} color="#F59E0B" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">{stats.rating}</Text>
              <Text className="text-gray-500 text-sm">{t('rating')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Pending Orders Section */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-4 pt-5 pb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-900 font-bold text-lg">
              {t('newOrders')}
              {pendingJobs.length > 0 && (
                <Text className="text-blue-500"> ({pendingJobs.length})</Text>
              )}
            </Text>
            <Pressable
              onPress={() => fetchPendingJobs(true)}
              accessibilityLabel={t('refresh')}
              accessibilityRole="button"
              className="flex-row items-center bg-blue-50 px-3 py-1.5 rounded-full active:opacity-70"
            >
              <RefreshCw size={14} color="#3B82F6" />
              <Text className="text-blue-600 text-sm font-medium mr-1.5">{t('refresh')}</Text>
            </Pressable>
          </View>

          {jobsLoading ? (
            <View className="bg-white rounded-2xl p-10 items-center">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : pendingJobs.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                <Wrench size={30} color="#9CA3AF" />
              </View>
              <Text className="text-gray-700 font-semibold text-base">{t('noNewOrders')}</Text>
              <Text className="text-gray-400 text-sm mt-1 text-center">{t('pullToRefresh')}</Text>
            </View>
          ) : (
            pendingJobs.map((job, index) => (
              <Animated.View
                key={job.id}
                entering={FadeInRight.delay(index * 80).duration(350)}
                className="bg-white rounded-3xl mb-4 overflow-hidden shadow-md shadow-black/10"
              >
                {/* Top accent */}
                <View style={{ height: 4, backgroundColor: '#10B981' }} />

                <View className="p-5">
                  {/* Customer row */}
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center">
                      {job.customer?.avatar_url ? (
                        <Image
                          source={{ uri: job.customer.avatar_url }}
                          style={{ width: 52, height: 52, borderRadius: 26 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 22 }}>👤</Text>
                        </View>
                      )}
                      <View className="mr-3">
                        <Text className="text-gray-900 font-bold text-lg">{job.customer?.name ?? 'לקוח'}</Text>
                        <Text className="text-gray-400 text-sm">{formatTime(job.created_at)}</Text>
                      </View>
                    </View>
                    <View className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                      <Text className="text-emerald-700 font-bold text-base">
                        ₪{job.estimated_price_min}–{job.estimated_price_max}
                      </Text>
                    </View>
                  </View>

                  {/* Issue row */}
                  <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 mb-4">
                    <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center ml-3">
                      <Wrench size={20} color="#F97316" />
                    </View>
                    <Text className="text-gray-700 text-base flex-1 leading-5" numberOfLines={2}>
                      {job.bike_type === 'electric' ? t('electricBikeShort') : t('regularBikeShort')} · {job.description}
                    </Text>
                  </View>

                  {/* Customer photo */}
                  {!!job.photo_url && (
                    <View className="mb-4 rounded-2xl overflow-hidden" style={{ height: 180 }}>
                      <Image
                        source={{ uri: job.photo_url }}
                        style={{ width: '100%', height: 180 }}
                        contentFit="cover"
                      />
                    </View>
                  )}

                  {/* Contact info: phone + address */}
                  <View className="bg-gray-50 rounded-2xl overflow-hidden mb-4">
                    {!!job.customer?.phone && (
                      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
                        <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center ml-3">
                          <Phone size={16} color="#3B82F6" />
                        </View>
                        <Text className="text-gray-800 text-base font-medium flex-1" style={{ textAlign: 'left', direction: 'ltr' }}>
                          {job.customer.phone}
                        </Text>
                      </View>
                    )}
                    {!!job.customer_location.address && (
                      <View className="flex-row items-center px-4 py-3">
                        <View className="w-8 h-8 bg-red-100 rounded-full items-center justify-center ml-3">
                          <MapPin size={16} color="#EF4444" />
                        </View>
                        <Text className="text-gray-800 text-sm flex-1 leading-5">
                          {job.customer_location.address}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Accept button — big and prominent */}
                  <Pressable
                    onPress={() => handleAcceptJob(job)}
                    disabled={acceptingJobId === job.id}
                    accessibilityLabel={t('acceptJob')}
                    accessibilityRole="button"
                    style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
                  >
                    <LinearGradient
                      colors={acceptingJobId === job.id ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ borderRadius: 18, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                      {acceptingJobId === job.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Check size={22} color="#fff" strokeWidth={2.5} />
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: 0.2 }}>{t('acceptJob')}</Text>
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      <ConfirmModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        confirmText={t('close')}
        cancelText={t('close')}
        onConfirm={() => setErrorModal((s) => ({ ...s, visible: false }))}
        onCancel={() => setErrorModal((s) => ({ ...s, visible: false }))}
      />
    </View>
  );
}
