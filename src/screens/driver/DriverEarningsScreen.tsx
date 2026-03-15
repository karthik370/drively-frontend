import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getDriverEarnings, getEarningsBreakdown } from '../../services/api';
import EarningsGoalCard from '../../components/driver/EarningsGoalCard';

const DriverEarningsScreen = () => {
  const [todayEarnings, setTodayEarnings] = useState<number | null>(null);
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null);
  const [previousEarnings, setPreviousEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = await getDriverEarnings('today');
        setTodayEarnings(typeof today?.earnings === 'number' ? today.earnings : 0);
        setTotalEarnings(typeof today?.totalEarnings === 'number' ? today.totalEarnings : 0);

        // Fetch real previous earnings breakdown for last 7 days
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const breakdown = await getEarningsBreakdown(sevenDaysAgo.toISOString().split('T')[0], now.toISOString().split('T')[0]);

        // Aggregate earnings by day
        const dailyMap: { [key: string]: number } = {};
        if (Array.isArray(breakdown?.bookings)) {
          breakdown.bookings.forEach((b: any) => {
            const date = b.completedAt ? new Date(b.completedAt).toISOString().split('T')[0] : null;
            if (date && date !== now.toISOString().split('T')[0]) {
              dailyMap[date] = (dailyMap[date] || 0) + Number(b.driverEarnings || 0);
            }
          });
        }

        // Build list from oldest to newest, excluding today
        const list: any[] = [];
        for (let i = 6; i >= 1; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = d.toISOString().split('T')[0];
          const amount = dailyMap[dateStr] || 0;
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          list.push({ label: dayName, amount });
        }

        // Add weekly total if we have data
        const weekTotal = list.reduce((sum, item) => sum + item.amount, 0);
        if (weekTotal > 0) {
          list.push({ label: 'Last 7 Days', amount: weekTotal });
        }

        setPreviousEarnings(list);
      } catch (e) {
        console.warn('Failed to load earnings', e);
        setTodayEarnings(0);
        setTotalEarnings(0);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#C9A84C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
      </View>

      <ScrollView style={styles.content}>
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  header: {
    padding: 24,
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalCard: {
    margin: 16,
    padding: 32,
    backgroundColor: '#C9A84C',
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
    color: '#ffffff',
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
    backgroundColor: '#0A0A0A',
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
    backgroundColor: '#0A0A0A',
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
    color: '#FFFFFF',
    marginBottom: 16,
  },
  previousItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  previousLabel: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  previousAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default DriverEarningsScreen;
