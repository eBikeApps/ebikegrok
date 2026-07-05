import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, UserPlus } from 'lucide-react-native';
import { I18nManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { api } from '@/lib/api/api';
import { getAvailableTechnicians, TechnicianWithDistance } from '@/lib/api/technicians';
import { useLocationStore } from '@/lib/store';
import { getEffectiveCustomerLocation } from '@/lib/customer-location';
import { useSession } from '@/lib/auth/use-session';

export default function InviteTechnicianScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { data: session } = useSession();
  const currentLocation = useLocationStore((s) => s.currentLocation);

  const [technicians, setTechnicians] = useState<TechnicianWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const myId = session?.user?.id;

  const loadTechnicians = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAvailableTechnicians(getEffectiveCustomerLocation(currentLocation));
      setTechnicians(list.filter((t) => t.id !== myId));
    } catch {
      setTechnicians([]);
    } finally {
      setLoading(false);
    }
  }, [currentLocation, myId]);

  useEffect(() => {
    loadTechnicians();
  }, [loadTechnicians]);

  const handleInvite = async (inviteeId: string) => {
    if (!jobId || invitingId) return;
    setInvitingId(inviteeId);
    try {
      await api.post(`/api/jobs/${jobId}/invite`, { inviteeId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setInvitingId(null);
    }
  };

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', paddingTop: insets.top + 24, paddingHorizontal: 24 }}>
        <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 80 }}>
          ההזמנה נשלחה
        </Text>
        <Text style={{ color: '#94A3B8', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
          הטכנאי יקבל התראה ויוכל לאשר את השיתוף.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 40 }}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>חזרה לעבודה</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
          <BackIcon size={22} color="#F8FAFC" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '800' }}>הזמן טכנאי נוסף</Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>בחר טכנאי זמין לשיתוף בעבודה</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#10B981" size="large" />
        </View>
      ) : technicians.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 15 }}>אין טכנאים זמינים כרגע באזור</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {technicians.map((tech) => (
            <Pressable
              key={tech.id}
              onPress={() => handleInvite(tech.id)}
              disabled={!!invitingId}
              style={{
                backgroundColor: '#1E293B',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: invitingId && invitingId !== tech.id ? 0.5 : 1,
              }}
            >
              <Image
                source={{ uri: tech.avatar_url || undefined }}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#334155' }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 16 }}>{tech.name}</Text>
                <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>
                  ⭐ {tech.rating.toFixed(1)} · ₪{tech.base_price}
                </Text>
              </View>
              {invitingId === tech.id ? (
                <ActivityIndicator color="#10B981" />
              ) : (
                <UserPlus size={22} color="#10B981" />
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}