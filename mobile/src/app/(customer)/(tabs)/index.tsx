import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import ConfirmModal from '@/components/ConfirmModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { User, MapPin, Star, Wrench, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { useLanguageStore, useLocationStore, useActiveJobStore } from '@/lib/store';
import { calculateDistance, estimateArrivalTime } from '@/lib/mock-data';
import { TechnicianProfile, Location as LocationType, Job } from '@/lib/types';
import { useSession } from '@/lib/auth/use-session';
import { authClient } from '@/lib/auth/auth-client';

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; overflow: hidden; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map, userMarker, techMarkers = [];

  function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: ${lat}, lng: ${lng} },
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
      ]
    });

    userMarker = new google.maps.Marker({
      position: { lat: ${lat}, lng: ${lng} },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3B82F6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      zIndex: 999,
    });

    map.addListener('click', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapPress' }));
    });
  }

  function updateLocation(lat, lng) {
    var pos = { lat: lat, lng: lng };
    if (userMarker) userMarker.setPosition(pos);
  }

  function centerMap(lat, lng) {
    if (map) map.setCenter({ lat: lat, lng: lng });
  }

  function updateMarkers(technicians, selectedId) {
    techMarkers.forEach(function(m) { m.marker.setMap(null); });
    techMarkers = [];
    technicians.forEach(function(tech) {
      var isSelected = tech.id === selectedId;
      var marker = new google.maps.Marker({
        position: { lat: tech.lat, lng: tech.lng },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 20 : 16,
          fillColor: isSelected ? '#3B82F6' : '#22C55E',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: tech.name,
        zIndex: isSelected ? 100 : 10,
      });
      marker.addListener('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'techPress', id: tech.id }));
      });
      techMarkers.push({ id: tech.id, marker: marker });
    });
  }

  document.addEventListener('message', handleMsg);
  window.addEventListener('message', handleMsg);
  function handleMsg(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'updateLocation') updateLocation(msg.lat, msg.lng);
      else if (msg.type === 'centerMap') centerMap(msg.lat, msg.lng);
      else if (msg.type === 'updateMarkers') updateMarkers(msg.technicians, msg.selectedId);
    } catch(err) {}
  }
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap&language=he"></script>
</body>
</html>`;
}

function mapDbJobToActive(dbJob: any): Job {
  return {
    id: dbJob.id,
    customer_id: dbJob.customerId,
    technician_id: dbJob.technicianId,
    status: dbJob.status,
    photo_url: dbJob.photoUrl ?? '',
    description: dbJob.description ?? '',
    bike_type: dbJob.bikeType,
    categories: dbJob.categories ?? (dbJob.category ? [dbJob.category] : []),
    estimated_price_min: dbJob.estimatedPriceMin ?? 0,
    estimated_price_max: dbJob.estimatedPriceMax ?? 0,
    customer_location: { latitude: dbJob.customerLocationLat, longitude: dbJob.customerLocationLng },
    technician_location: dbJob.technician?.currentLocationLat && dbJob.technician?.currentLocationLng
      ? { latitude: dbJob.technician.currentLocationLat, longitude: dbJob.technician.currentLocationLng }
      : undefined,
    created_at: dbJob.createdAt,
    technician: dbJob.technician
      ? {
          id: dbJob.technician.id,
          name: dbJob.technician.name,
          email: dbJob.technician.email ?? '',
          phone: dbJob.technician.phone ?? '',
          avatar_url: dbJob.technician.image ?? '',
          role: 'technician' as const,
          rating: dbJob.technician.rating ?? 0,
          total_reviews: dbJob.technician.totalReviews ?? 0,
          verification_status: 'verified' as const,
          vehicle_type: dbJob.technician.vehicleType ?? '',
          service_radius: 10,
          is_available: true,
          base_price: dbJob.technician.basePrice ?? 0,
          total_earnings: 0,
          current_location: dbJob.technician.currentLocationLat && dbJob.technician.currentLocationLng
            ? { latitude: dbJob.technician.currentLocationLat, longitude: dbJob.technician.currentLocationLng }
            : undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : undefined,
  } as Job;
}

export default function CustomerHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useLanguageStore((s) => s.t);
  const { data: session } = useSession();
  const user = session?.user;
  const currentLocation = useLocationStore((s) => s.currentLocation);
  const setCurrentLocation = useLocationStore((s) => s.setCurrentLocation);
  const setLocationPermission = useLocationStore((s) => s.setLocationPermission);
  const setActiveJobInStore = useActiveJobStore((s) => s.setActiveJob);

  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianProfile | null>(null);
  const [nearbyTechnicians, setNearbyTechnicians] = useState<TechnicianProfile[]>([]);
  const [allTechnicians, setAllTechnicians] = useState<TechnicianProfile[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationModalForRepair, setLocationModalForRepair] = useState(false);

  const defaultLat = 32.0853;
  const defaultLng = 34.7818;

  const [mapLat, setMapLat] = useState(defaultLat);
  const [mapLng, setMapLng] = useState(defaultLng);

  // Check for an active job whenever the screen comes into focus.
  // If one exists, hydrate the store and redirect to job-tracking so the customer
  // can't accidentally create a parallel order while a technician is engaged.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const check = async () => {
        try {
          const result = await authClient.getSession();
          const token = (result as any)?.data?.session?.token;
          if (!token) return;
          const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/jobs/customer/active`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = await res.json();
          if (cancelled) return;
          if (data?.job) {
            setActiveJobId(data.job.id);
            setActiveJobInStore(mapDbJobToActive(data.job));
            router.replace({ pathname: '/job-tracking', params: { id: data.job.id } });
          } else {
            setActiveJobId(null);
            setActiveJobInStore(null);
          }
        } catch {
          // ignore
        }
      };
      check();
      return () => {
        cancelled = true;
      };
    }, [router, setActiveJobInStore])
  );

  useEffect(() => {
    requestLocationPermission();
    fetchTechnicians();
  }, []);

  useEffect(() => {
    if (currentLocation && allTechnicians.length > 0) {
      const nearby = allTechnicians.filter((tech) => {
        if (!tech.current_location || !tech.is_available) return false;
        const distance = calculateDistance(currentLocation, tech.current_location);
        return distance <= 10;
      });
      setNearbyTechnicians(nearby);
    }
  }, [currentLocation, allTechnicians]);

  useEffect(() => {
    if (!mapReady) return;
    const markers = nearbyTechnicians
      .filter((t) => t.current_location)
      .map((t) => ({
        id: t.id,
        lat: t.current_location!.latitude,
        lng: t.current_location!.longitude,
        name: t.name,
      }));
    webViewRef.current?.injectJavaScript(
      `updateMarkers(${JSON.stringify(markers)}, ${JSON.stringify(selectedTechnician?.id ?? null)}); true;`
    );
  }, [nearbyTechnicians, selectedTechnician, mapReady]);

  useEffect(() => {
    if (!mapReady || !currentLocation) return;
    webViewRef.current?.injectJavaScript(
      `updateLocation(${currentLocation.latitude}, ${currentLocation.longitude}); true;`
    );
  }, [currentLocation, mapReady]);

  const fetchTechnicians = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
      const sessionResult = await authClient.getSession();
      const token = (sessionResult as any)?.data?.session?.token;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${backendUrl}/api/technicians/available`, { headers });
      if (response.ok) {
        const data = await response.json();
        const transformedTechs: TechnicianProfile[] = data.technicians.map((tech: any) => ({
          id: tech.id,
          name: tech.name,
          email: tech.email ?? '',
          phone: tech.phone ?? '',
          avatar_url: tech.image ?? '',
          role: 'technician' as const,
          bio: tech.bio ?? '',
          rating: tech.rating ?? 0,
          total_reviews: tech.totalReviews ?? 0,
          verification_status: 'verified' as const,
          vehicle_type: tech.vehicleType ?? '',
          service_radius: tech.serviceRadius ?? 0,
          is_available: tech.isAvailable ?? false,
          current_location: tech.currentLocationLat && tech.currentLocationLng
            ? { latitude: tech.currentLocationLat, longitude: tech.currentLocationLng }
            : undefined,
          base_price: tech.basePrice ?? 0,
          total_earnings: tech.totalEarnings ?? 0,
          created_at: tech.createdAt,
          updated_at: tech.updatedAt,
        }));
        setAllTechnicians(transformedTechs);
      }
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted' ? 'granted' : 'denied');
      if (status === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({});
          const newLocation: LocationType = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(newLocation);
          setMapLat(newLocation.latitude);
          setMapLng(newLocation.longitude);
        } catch {
          setCurrentLocation({ latitude: defaultLat, longitude: defaultLng });
        }
      } else {
        setLocationModalForRepair(false);
        setLocationModalVisible(true);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const refreshLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const newLocation: LocationType = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(newLocation);
      setMapLat(newLocation.latitude);
      setMapLng(newLocation.longitude);
    } catch {
      // ignore location errors on refresh
    }
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refreshLocation();
    fetchTechnicians();
  };

  const handleRequestRepair = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeJobId) {
      router.replace({ pathname: '/job-tracking', params: { id: activeJobId } });
      return;
    }
    const locationPermission = useLocationStore.getState().locationPermission;
    if (locationPermission === 'denied') {
      setLocationModalForRepair(true);
      setLocationModalVisible(true);
      return;
    }
    router.push('/repair-request');
  };

  const handleViewProfile = () => {
    if (selectedTechnician) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({ pathname: '/technician-profile', params: { id: selectedTechnician.id } });
    }
  };

  const centerOnUser = () => {
    if (currentLocation) {
      Haptics.selectionAsync();
      webViewRef.current?.injectJavaScript(
        `centerMap(${currentLocation.latitude}, ${currentLocation.longitude}); true;`
      );
    }
  };

  const getDistance = (tech: TechnicianProfile): string => {
    if (!currentLocation || !tech.current_location) return '-';
    return calculateDistance(currentLocation, tech.current_location).toFixed(1);
  };

  const getEta = (tech: TechnicianProfile): number => {
    if (!currentLocation || !tech.current_location) return 0;
    return estimateArrivalTime(calculateDistance(currentLocation, tech.current_location));
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'techPress') {
        const tech = nearbyTechnicians.find((t) => t.id === msg.id) ?? null;
        Haptics.selectionAsync();
        setSelectedTechnician(tech);
      } else if (msg.type === 'mapPress') {
        setSelectedTechnician(null);
      }
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: '#fff', zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, backgroundColor: '#DBEAFE', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              {user?.image ? (
                <Image source={{ uri: user.image }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              ) : (
                <User size={20} color="#3B82F6" />
              )}
            </View>
            <View>
              <Text style={{ color: '#6B7280', fontSize: 12 }}>{t('hello')}</Text>
              <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>{user?.name ?? 'משתמש'}</Text>
            </View>
          </View>
          <Pressable
            onPress={handleRefresh}
            accessibilityLabel={t('refresh')}
            accessibilityRole="button"
            style={{ width: 44, height: 44, backgroundColor: '#F3F4F6', borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshCw size={20} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      {/* Map */}
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={{ marginTop: 16, color: '#6B7280' }}>{t('loading')}</Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            style={{ flex: 1 }}
            source={{ html: buildMapHtml(mapLat, mapLng), baseUrl: 'https://maps.googleapis.com' }}
            onMessage={handleWebViewMessage}
            onLoadEnd={() => setMapReady(true)}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
          />
        )}

        {/* Center on User Button */}
        {currentLocation && !isLoading && (
          <Pressable
            onPress={centerOnUser}
            accessibilityLabel={t('locationActive')}
            accessibilityRole="button"
            style={{ position: 'absolute', top: 16, right: 16, width: 48, height: 48, backgroundColor: '#fff', borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}
          >
            <MapPin size={24} color="#3B82F6" />
          </Pressable>
        )}

        {/* Selected Technician Card */}
        {selectedTechnician && (
          <Animated.View entering={FadeInUp.duration(300)} style={{ position: 'absolute', bottom: 128, left: 16, right: 16 }}>
            <Pressable
              onPress={handleViewProfile}
              style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4, flexDirection: 'row', alignItems: 'center' }}
            >
              <Image source={{ uri: selectedTechnician.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28 }} />
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>{selectedTechnician.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text style={{ color: '#6B7280', fontSize: 13, marginLeft: 4 }}>
                    {selectedTechnician.rating} ({selectedTechnician.total_reviews})
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 }}>
                  <Text style={{ color: '#6B7280', fontSize: 13 }}>{getDistance(selectedTechnician)} {t('kmAway')}</Text>
                  <Text style={{ color: '#16A34A', fontSize: 13, fontWeight: '600' }}>{getEta(selectedTechnician)} {t('minutes')}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#3B82F6', fontWeight: '600', fontSize: 13 }}>{t('viewProfile')}</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Location Permission Modal */}
        <ConfirmModal
          visible={locationModalVisible}
          title={t('locationPermissionTitle')}
          message={locationModalForRepair ? t('locationPermissionBodyRepair') : t('locationPermissionBody')}
          confirmText={t('openSettings')}
          cancelText={t('close')}
          onConfirm={() => { setLocationModalVisible(false); Linking.openSettings(); }}
          onCancel={() => setLocationModalVisible(false)}
        />

        {/* Request Repair FAB */}
        <View style={{ position: 'absolute', bottom: 32, left: 24, right: 24 }}>
          <Pressable
            onPress={handleRequestRepair}
            accessibilityLabel={t('requestRepairNow')}
            accessibilityRole="button"
            style={{ opacity: 1 }}
          >
            <LinearGradient
              colors={['#3B82F6', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 16, padding: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Wrench size={24} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, marginLeft: 12 }}>{t('requestRepairNow')}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
