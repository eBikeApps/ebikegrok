import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ChevronLeft, Users, Check, X, Wrench, Bike, Zap, Clock } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '@/lib/api/api';

interface Invitation {
  id: string;
  jobId: string;
  status: string;
  createdAt: string;
  job: {
    id: string;
    description: string;
    category: string;
    bikeType: string;
    estimatedPriceMin: number;
    estimatedPriceMax: number;
    customer?: { id: string; name: string; image?: string };
    technician?: { id: string; name: string; image?: string; rating?: number };
  };
  inviter: {
    id: string;
    name: string;
    image?: string;
    rating?: number;
    callOutFee?: number;
  };
}

export default function InvitationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invitations', 'pending'],
    queryFn: async () => {
      return api.get<{ invitations: Invitation[] }>('/api/jobs/invitations/pending');
    },
    refetchInterval: 10000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'accepted' | 'rejected' }) => {
      const res = await api.patch<{ success: boolean; action: string }>(`/api/jobs/invitations/${id}`, { action });
      return { ...res, invitationId: id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      if (data.action === 'accepted') {
        router.back();
      }
    },
  });

  const handleRespond = async (id: string, action: 'accepted' | 'rejected') => {
    Haptics.impactAsync(
      action === 'accepted'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
    setRespondingId(id);
    try {
      await respondMutation.mutateAsync({ id, action });
    } finally {
      setRespondingId(null);
    }
  };

  const invitations = data?.invitations ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>הזמנות לשיתוף</Text>
            {invitations.length > 0 && (
              <View style={{ backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 }}>
                <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>{invitations.length} ממתינות</Text>
              </View>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <ActivityIndicator size="large" color="#F59E0B" />
            </View>
          ) : invitations.length === 0 ? (
            <Animated.View entering={FadeInUp.duration(400)} style={{ alignItems: 'center', paddingTop: 80 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Users size={36} color="#F59E0B" />
              </View>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>אין הזמנות ממתינות</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' }}>
                כשטכנאי אחר יזמין אותך לשיתוף עבודה, ההזמנה תופיע כאן
              </Text>
            </Animated.View>
          ) : (
            invitations.map((inv, index) => {
              const isElectric = inv.job.bikeType === 'electric';
              const isResponding = respondingId === inv.id;
              const callOutFee = inv.inviter.callOutFee ?? 50;
              const halfPrice = Math.floor(inv.job.estimatedPriceMin / 2);
              const myEstimate = halfPrice + callOutFee;

              return (
                <Animated.View
                  key={inv.id}
                  entering={FadeInUp.delay(index * 80).duration(400)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 20,
                    marginBottom: 16,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(245,158,11,0.2)',
                  }}
                >
                  {/* Invitation badge */}
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Users size={14} color="#000" />
                    <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>הזמנה לשיתוף עבודה</Text>
                    <View style={{ flex: 1 }} />
                    <Clock size={12} color="rgba(0,0,0,0.6)" />
                    <Text style={{ color: 'rgba(0,0,0,0.6)', fontSize: 11 }}>
                      {new Date(inv.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </LinearGradient>

                  <View style={{ padding: 16 }}>
                    {/* Inviter info */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                      <Image
                        source={{ uri: inv.inviter.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(inv.inviter.name)}&background=F59E0B&color=000` }}
                        style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#F59E0B' }}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{inv.inviter.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>מזמין אותך לשיתוף עבודה</Text>
                        {inv.inviter.rating && (
                          <Text style={{ color: '#F59E0B', fontSize: 12, marginTop: 2 }}>⭐ {inv.inviter.rating.toFixed(1)}</Text>
                        )}
                      </View>
                    </View>

                    {/* Job details */}
                    <View style={{
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 16,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        {isElectric ? (
                          <Zap size={16} color="#F59E0B" />
                        ) : (
                          <Bike size={16} color="#60A5FA" />
                        )}
                        <Text style={{ color: isElectric ? '#F59E0B' : '#60A5FA', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                          {isElectric ? 'אופניים חשמליים' : 'קורקינט / אופניים'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Wrench size={14} color="rgba(255,255,255,0.4)" />
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginLeft: 6 }}>{inv.job.description}</Text>
                      </View>
                    </View>

                    {/* Earnings estimate */}
                    <View style={{
                      backgroundColor: 'rgba(16,185,129,0.1)',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(16,185,129,0.2)',
                    }}>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 }}>הרווח שלך מהעבודה הזו</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ color: '#10B981', fontSize: 22, fontWeight: '800' }}>~₪{myEstimate}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                            50% (₪{halfPrice}) + דמי יציאה ₪{callOutFee}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>מחיר מינימלי</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' }}>
                            ₪{inv.job.estimatedPriceMin}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable
                        onPress={() => handleRespond(inv.id, 'rejected')}
                        disabled={isResponding}
                        style={{
                          flex: 1,
                          paddingVertical: 14,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 6,
                          backgroundColor: 'rgba(239,68,68,0.12)',
                          borderWidth: 1,
                          borderColor: 'rgba(239,68,68,0.3)',
                        }}
                      >
                        <X size={18} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '700' }}>דחה</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleRespond(inv.id, 'accepted')}
                        disabled={isResponding}
                        style={{ flex: 2, borderRadius: 14, overflow: 'hidden' }}
                      >
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            paddingVertical: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 6,
                          }}
                        >
                          {isResponding ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Check size={18} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>קבל הזמנה</Text>
                            </>
                          )}
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
