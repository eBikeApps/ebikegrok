import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { DollarSign, TrendingUp, ArrowDownRight, ArrowUpRight, Wallet, Briefcase, Star, ArrowUpCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useLanguageStore } from '@/lib/store';
import { Transaction } from '@/lib/types';
import { useSession } from '@/lib/auth/use-session';
import { cn } from '@/lib/cn';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL!;

// Map Prisma camelCase → Transaction snake_case
const mapTransaction = (t: any): Transaction => ({
  id: t.id,
  technician_id: t.technicianId,
  job_id: t.jobId ?? undefined,
  type: t.type,
  amount: t.amount,
  status: t.status,
  created_at: t.createdAt,
});

export default function TechnicianEarningsScreen() {
  const language = useLanguageStore((s) => s.language);
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');

  const { data: sessionData } = useSession();
  const token = (sessionData as any)?.session?.token as string | undefined;

  const authedFetch = async (path: string) => {
    if (!token) throw new Error('No session');
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };

  const balanceQuery = useQuery({
    queryKey: ['technician', 'balance', token],
    queryFn: () => authedFetch('/api/technician/balance'),
    enabled: !!token,
    staleTime: 30_000,
  });

  const transactionsQuery = useQuery({
    queryKey: ['technician', 'transactions', token],
    queryFn: async () => {
      const data = await authedFetch('/api/technician/transactions');
      return (data.transactions || []).map(mapTransaction) as Transaction[];
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: ['technician', 'stats', token],
    queryFn: () => authedFetch('/api/technician/stats'),
    enabled: !!token,
    staleTime: 30_000,
  });

  const isLoading = !token || balanceQuery.isLoading || transactionsQuery.isLoading || statsQuery.isLoading;
  const transactions = transactionsQuery.data ?? [];
  const balance: number = balanceQuery.data?.balance ?? 0;
  const stats = statsQuery.data;

  const isRefreshing = balanceQuery.isFetching || transactionsQuery.isFetching || statsQuery.isFetching;

  const refreshAll = () => {
    if (!token) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    balanceQuery.refetch();
    transactionsQuery.refetch();
    statsQuery.refetch();
  };

  // Earnings for selected period
  const getPeriodEarnings = () => {
    const now = new Date();
    let start: Date;
    switch (selectedPeriod) {
      case 'today':
        start = new Date(now); start.setHours(0, 0, 0, 0); break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    }
    return transactions
      .filter((t) => t.type === 'earning' && new Date(t.created_at) >= start)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Last 7 days bar chart from real transactions
  const getDailyBars = () => {
    const bars: number[] = Array(7).fill(0);
    const now = new Date();
    transactions.forEach((t) => {
      if (t.type !== 'earning') return;
      const d = new Date(t.created_at);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (daysAgo >= 0 && daysAgo < 7) {
        bars[6 - daysAgo] += t.amount;
      }
    });
    return bars;
  };

  const dailyBars = getDailyBars();
  const maxBar = Math.max(...dailyBars, 1);

  const earnings = getPeriodEarnings();

  const periods = [
    { key: 'today' as const, label: 'היום' },
    { key: 'week' as const, label: 'שבוע' },
    { key: 'month' as const, label: 'חודש' },
  ];

  const dayLabels = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const todayDow = new Date().getDay(); // 0=Sun
  const last7Labels = Array.from({ length: 7 }, (_, i) => dayLabels[(todayDow - 6 + i + 7) % 7]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} tintColor="#10B981" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#0F172A' }}>
            {language === 'he' ? 'רווחים' : 'Earnings'}
          </Text>
        </View>

        {/* Balance Card */}
        <Animated.View entering={FadeInUp.delay(50).duration(400)} style={{ marginHorizontal: 16, marginTop: 12 }}>
          <LinearGradient
            colors={['#10B981', '#059669', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 24, padding: 24 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={20} color="#fff" />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500' }}>
                  {language === 'he' ? 'יתרה כוללת' : 'Total Balance'}
                </Text>
              </View>
              {stats?.todaysEarnings > 0 && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>+₪{stats.todaysEarnings} היום</Text>
                </View>
              )}
            </View>

            {isLoading ? (
              <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />
            ) : (
              <Text style={{ color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1, marginTop: 4 }}>
                ₪{balance.toLocaleString()}
              </Text>
            )}

            {/* Withdraw button inside card */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/withdrawal-request');
              }}
              style={{
                marginTop: 16,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                borderRadius: 14,
                paddingVertical: 13,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <ArrowUpCircle size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {language === 'he' ? 'משוך כספים' : 'Withdraw'}
              </Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        {/* Stats row */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View style={{ width: 36, height: 36, backgroundColor: '#EFF6FF', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Briefcase size={18} color="#3B82F6" />
            </View>
            <Text style={{ color: '#0F172A', fontSize: 22, fontWeight: '800' }}>{stats?.todaysJobs ?? '—'}</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>עבודות היום</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View style={{ width: 36, height: 36, backgroundColor: '#FEF9C3', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Briefcase size={18} color="#CA8A04" />
            </View>
            <Text style={{ color: '#0F172A', fontSize: 22, fontWeight: '800' }}>{stats?.weeklyJobs ?? '—'}</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>עבודות השבוע</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View style={{ width: 36, height: 36, backgroundColor: '#FFF7ED', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Star size={18} color="#F97316" />
            </View>
            <Text style={{ color: '#0F172A', fontSize: 22, fontWeight: '800' }}>{stats?.rating ?? '—'}</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>דירוג</Text>
          </View>
        </Animated.View>

        {/* Period + Earnings + Chart */}
        <Animated.View entering={FadeInUp.delay(150).duration(400)} style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 22, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          {/* Period selector */}
          <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 3, marginBottom: 20 }}>
            {periods.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => { Haptics.selectionAsync(); setSelectedPeriod(p.key); }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                  backgroundColor: selectedPeriod === p.key ? '#fff' : 'transparent',
                  shadowColor: selectedPeriod === p.key ? '#000' : 'transparent',
                  shadowOpacity: 0.06, shadowRadius: 4, elevation: selectedPeriod === p.key ? 2 : 0,
                }}
              >
                <Text style={{
                  fontSize: 14, fontWeight: selectedPeriod === p.key ? '700' : '500',
                  color: selectedPeriod === p.key ? '#10B981' : '#94A3B8',
                }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Earnings total */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <View>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>
                {selectedPeriod === 'today' ? 'הכנסות היום' : selectedPeriod === 'week' ? 'הכנסות שבוע' : 'הכנסות חודש'}
              </Text>
              <Text style={{ color: '#0F172A', fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 }}>
                ₪{earnings.toLocaleString()}
              </Text>
            </View>
            <View style={{ width: 52, height: 52, backgroundColor: '#ECFDF5', borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={26} color="#10B981" />
            </View>
          </View>

          {/* Bar chart — real data */}
          <View style={{ height: 80 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
              {dailyBars.map((val, i) => {
                const heightPct = maxBar > 0 ? (val / maxBar) : 0;
                const isToday = i === 6;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View
                      style={{
                        width: '100%',
                        height: Math.max(6, heightPct * 56),
                        borderRadius: 6,
                        backgroundColor: isToday ? '#10B981' : '#D1FAE5',
                      }}
                    />
                    <Text style={{ color: '#94A3B8', fontSize: 10 }}>{last7Labels[i]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          {transactions.length === 0 && !isLoading && (
            <Text style={{ color: '#CBD5E1', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              הגרף יוצג לאחר השלמת עבודות
            </Text>
          )}
        </Animated.View>

        {/* Transaction History */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={{ marginHorizontal: 16, marginTop: 16 }}>
          <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 17, marginBottom: 10 }}>
            {language === 'he' ? 'היסטוריית עסקאות' : 'Transaction History'}
          </Text>

          <View style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            {isLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#10B981" />
              </View>
            ) : transactions.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, backgroundColor: '#F1F5F9', borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <DollarSign size={26} color="#CBD5E1" />
                </View>
                <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '600' }}>
                  {language === 'he' ? 'אין עדיין עסקאות' : 'No transactions yet'}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>
                  עסקאות יופיעו לאחר השלמת עבודות
                </Text>
              </View>
            ) : (
              transactions.map((tx, i) => {
                const isEarning = tx.type === 'earning';
                const isLast = i === transactions.length - 1;
                return (
                  <View
                    key={tx.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: '#F1F5F9',
                    }}
                  >
                    <View style={{
                      width: 42, height: 42, borderRadius: 21,
                      backgroundColor: isEarning ? '#ECFDF5' : '#FEF2F2',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isEarning
                        ? <ArrowDownRight size={20} color="#10B981" />
                        : <ArrowUpRight size={20} color="#EF4444" />
                      }
                    </View>

                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Text style={{ color: '#0F172A', fontWeight: '600', fontSize: 15 }}>
                        {isEarning ? 'תשלום מעבודה' : 'משיכת כספים'}
                      </Text>
                      <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
                        {tx.created_at && !isNaN(new Date(tx.created_at).getTime())
                          ? format(new Date(tx.created_at), 'dd/MM/yyyy · HH:mm', { locale: language === 'he' ? he : undefined })
                          : '—'}
                      </Text>
                    </View>

                    <Text style={{
                      fontWeight: '800', fontSize: 17,
                      color: isEarning ? '#10B981' : '#EF4444',
                    }}>
                      {isEarning ? '+' : '-'}₪{tx.amount.toLocaleString()}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
