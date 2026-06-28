import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getDriverEarnings, getEarningsBreakdown } from '../../services/api';
import EarningsGoalCard from '../../components/driver/EarningsGoalCard';
import { EarningsSkeleton } from '../../components/common/LoadingSkeleton';
import { G } from '../../constants/glassStyles';

type DailyEarning = { label: string; amount: number };

const DriverEarningsScreen = () => {
  const [todayEarnings, setTodayEarnings] = useState<number | null>(null);
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null);
  const [previousEarnings, setPreviousEarnings] = useState<DailyEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // isMounted ref — prevents setState after unmount (no memory leaks)
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // ── Parallel fetch: both calls fire at the SAME TIME ─────────────────
      // Old code: getDriverEarnings → wait → getEarningsBreakdown (2x slower)
      // New code: both fire together, done when the slower one finishes
      const [today, breakdown] = await Promise.all([
        getDriverEarnings('today'),
        getEarningsBreakdown(
          sevenDaysAgo.toISOString().split('T')[0],
          now.toISOString().split('T')[0],
        ),
      ]);

      if (!isMounted.current) return;

      setTodayEarnings(typeof today?.earnings === 'number' ? today.earnings : 0);
      setTotalEarnings(typeof today?.totalEarnings === 'number' ? today.totalEarnings : 0);

      // Aggregate earnings by day
      const todayStr = now.toISOString().split('T')[0];
      const dailyMap: Record<string, number> = {};
      if (Array.isArray(breakdown?.bookings)) {
        breakdown.bookings.forEach((b: any) => {
          const date = b.completedAt ? new Date(b.completedAt).toISOString().split('T')[0] : null;
          if (date && date !== todayStr) {
            dailyMap[date] = (dailyMap[date] || 0) + Number(b.driverEarnings || 0);
          }
        });
      }

      // Build list oldest → newest (excluding today)
      const list: DailyEarning[] = [];
      for (let i = 6; i >= 1; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        list.push({
          label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          amount: dailyMap[dateStr] || 0,
        });
      }

      const weekTotal = list.reduce((sum, item) => sum + item.amount, 0);
      if (weekTotal > 0) list.push({ label: 'Last 7 Days', amount: weekTotal });

      setPreviousEarnings(list);
    } catch {
      if (!isMounted.current) return;
      setTodayEarnings(0);
      setTotalEarnings(0);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // ── Skeleton while loading (first visit) ─────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
        </View>
        <EarningsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Earnings</Text>
          <Text style={styles.totalAmount}>₹{totalEarnings?.toFixed(0) || '0'}</Text>
          <Text style={styles.totalSubtext}>All time</Text>
        </View>

        <View style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Icon name="calendar-today" size={24} color="#10b981" />
            <Text style={styles.todayLabel}>Today's Earnings</Text>
          </View>
          <Text style={styles.todayAmount}>₹{todayEarnings?.toFixed(0) || '0'}</Text>
        </View>

        <EarningsGoalCard todayEarnings={todayEarnings ?? 0} dailyGoal={2000} />

        {previousEarnings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Previous Earnings</Text>
            {previousEarnings.map((item, index) => (
              <View key={index} style={styles.previousItem}>
                <Text style={styles.previousLabel}>{item.label}</Text>
                <Text style={styles.previousAmount}>₹{item.amount.toFixed(0)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bottom padding for safe scroll */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bgAlt,
  },
  header: {
    padding: 24,
    backgroundColor: G.bg,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: G.textPrimary,
  },
  content: {
    flex: 1,
  },
  totalCard: {
    margin: 16,
    padding: 32,
    backgroundColor: G.accent,
    borderRadius: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#bfdbfe',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: G.textPrimary,
  },
  totalSubtext: {
    fontSize: 14,
    color: '#bfdbfe',
    marginTop: 8,
  },
  todayCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: G.bg,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  todayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CCCCCC',
  },
  todayAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10b981',
    textAlign: 'center',
  },
  section: {
    backgroundColor: G.bg,
    padding: 20,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: G.textPrimary,
    marginBottom: 16,
  },
  previousItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
  },
  previousLabel: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  previousAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: G.textPrimary,
  },
});

export default React.memo(DriverEarningsScreen);
