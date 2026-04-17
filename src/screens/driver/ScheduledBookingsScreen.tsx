import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

import { getBookingHistory } from '../../services/api';
import { BookingStatus } from '../../types';

type ScheduledItem = {
  id: string;
  scheduledMs: number;
  dateLabel: string;
  pickup: string;
  drop: string;
};

const ScheduledBookingsScreen = () => {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await getBookingHistory(1, 50);
      const bookings = Array.isArray((res as any)?.bookings) ? ((res as any).bookings as any[]) : [];
      const nowMs = Date.now();

      const mapped: ScheduledItem[] = bookings
        .map((b: any) => {
          const scheduledRaw = b?.scheduledTime ? String(b.scheduledTime) : null;
          if (!scheduledRaw) return null;
          const d = new Date(scheduledRaw);
          if (!Number.isFinite(d.getTime())) return null;
          const scheduledMs = d.getTime();
          if (scheduledMs <= nowMs) return null;

          const status = String(b?.status ?? '');
          if (
            ![
              BookingStatus.ACCEPTED,
              BookingStatus.DRIVER_ARRIVING,
              BookingStatus.ARRIVED,
              BookingStatus.STARTED,
              BookingStatus.IN_PROGRESS,
            ].includes(status as any)
          ) {
            return null;
          }

          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          let hh = d.getHours();
          const ampm = hh >= 12 ? 'PM' : 'AM';
          hh = hh % 12;
          if (hh === 0) hh = 12;
          const min = String(d.getMinutes()).padStart(2, '0');
          const dateLabel = `${dd}/${mm}/${yyyy}, ${String(hh).padStart(2, '0')}:${min} ${ampm}`;

          return {
            id: String(b?.id ?? ''),
            scheduledMs,
            dateLabel,
            pickup: String(b?.pickupAddress ?? '—'),
            drop: String(b?.dropAddress ?? '—'),
          };
        })
        .filter(Boolean) as ScheduledItem[];

      mapped.sort((a, b) => {
        return Number(a.scheduledMs || 0) - Number(b.scheduledMs || 0);
      });

      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const data = useMemo(() => items, [items]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Icon name="calendar" size={26} color="#C9A84C" />
      </View>

      <FlatList
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="calendar-blank" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No scheduled bookings</Text>
            <Text style={styles.emptySub}>Upcoming scheduled trips will appear here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Icon name="clock-outline" size={18} color="#8A8A8A" />
              <Text style={styles.dateText}>{item.dateLabel}</Text>
            </View>
            <View style={styles.locationRow}>
              <Icon name="circle" size={10} color="#10b981" />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.pickup}
              </Text>
            </View>
            <View style={styles.connector} />
            <View style={styles.locationRow}>
              <Icon name="map-marker" size={12} color="#ef4444" />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.drop}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bgAlt,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: G.textPrimary,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: G.bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: G.border3,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: G.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  connector: {
    width: 2,
    height: 14,
    backgroundColor: G.glass3,
    marginLeft: 4,
    marginVertical: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: G.textPrimary,
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: G.textSecondary,
    textAlign: 'center',
  },
});

export default ScheduledBookingsScreen;
