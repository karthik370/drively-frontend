import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { listSupportThreads, type SupportThread } from '../../services/api';
import { G } from '../../constants/glassStyles';

const AdminNeedHelpInboxScreen = ({ navigation, route }: any) => {
  const filterBookingId = typeof route?.params?.filterBookingId === 'string' ? route.params.filterBookingId : '';
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<SupportThread[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listSupportThreads();
      setThreads(Array.isArray(res) ? res : []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Threads visible after optional bookingId filter
  const visibleThreads = useMemo(() => {
    if (!filterBookingId) return threads;
    return threads.filter((t) => String(t.bookingId) === String(filterBookingId));
  }, [threads, filterBookingId]);

  // Booking number for filtered view header
  const filteredBookingNumber = useMemo(() => {
    if (!filterBookingId) return '';
    const t = threads.find((t) => String(t.bookingId) === String(filterBookingId));
    return t?.booking?.bookingNumber ? `#${String(t.booking.bookingNumber).slice(0, 12)}` : `#${filterBookingId.slice(0, 8)}`;
  }, [threads, filterBookingId]);

  const headerRight = useMemo(() => {
    return (
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={() => {
          void load();
        }}
      >
        <Icon name="refresh" size={18} color="#ffffff" />
      </TouchableOpacity>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {filterBookingId ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 4 }}>
              <Icon name="arrow-left" size={20} color="#C9A84C" />
            </TouchableOpacity>
          ) : null}
          <Icon name="headset" size={22} color="#C9A84C" />
          <View>
            <Text style={styles.title}>Need Help</Text>
            {filterBookingId ? (
              <Text style={styles.subtitle}>Threads for booking {filteredBookingNumber}</Text>
            ) : null}
          </View>
        </View>
        {headerRight}
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#C9A84C" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : null}

      <FlatList
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
        data={visibleThreads}
        keyExtractor={(item) => `${item.bookingId}:${item.threadUserId}`}
        contentContainerStyle={visibleThreads.length ? styles.list : styles.listEmpty}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {filterBookingId ? 'No help requests for this booking' : 'No help requests'}
              </Text>
              <Text style={styles.emptySub}>
                {filterBookingId
                  ? 'Neither the customer nor driver has sent a help message for this booking yet.'
                  : 'When customers or drivers tap "Need Help", chats will appear here.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const b = item.booking;
          const bookingNumber = b?.bookingNumber ? `#${String(b.bookingNumber).slice(0, 12)}` : item.bookingId.slice(0, 8);
          const status = b?.status ? String(b.status) : '';
          const customerName = b?.customer?.name ? b.customer.name : 'Customer';
          const driverName = b?.driver?.name ? b.driver.name : 'Driver';
          const threadUserId = String(item.threadUserId || '');
          const customerId = b?.customer?.id ? String(b.customer.id) : '';
          const driverId = b?.driver?.id ? String(b.driver.id) : '';
          const senderRole = threadUserId && customerId && threadUserId === customerId ? 'Customer' : threadUserId && driverId && threadUserId === driverId ? 'Driver' : 'User';
          const senderName = senderRole === 'Customer' ? customerName : senderRole === 'Driver' ? driverName : 'User';
          // Icon colour differs by role so admin can instantly tell who is asking
          const roleColor = senderRole === 'Customer' ? '#2563eb' : senderRole === 'Driver' ? '#059669' : '#6b7280';
          const subtitle = filterBookingId
            ? `${senderName} (${senderRole})` // booking already shown in header
            : `${bookingNumber} • ${senderName} (${senderRole})`;

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.item}
              onPress={() => {
                try {
                  const parentNav = typeof navigation?.getParent === 'function' ? navigation.getParent() : null;
                  if (parentNav && typeof parentNav.navigate === 'function') {
                    parentNav.navigate('MainTabs', {
                      screen: 'SupportChat',
                      params: { bookingId: item.bookingId, threadUserId: item.threadUserId },
                    });
                    return;
                  }
                } catch {
                }

                try {
                  navigation.navigate('SupportChat', { bookingId: item.bookingId, threadUserId: item.threadUserId });
                } catch {
                }
              }}
            >
              <View style={[styles.itemIcon, { borderColor: roleColor + '40', backgroundColor: roleColor + '18' }]}>
                <Icon name={senderRole === 'Customer' ? 'account' : senderRole === 'Driver' ? 'car' : 'chat-processing'} size={18} color={roleColor} />
              </View>
              <View style={styles.itemBody}>
                <View style={styles.itemTopRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {bookingNumber}
                  </Text>
                  {status ? (
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{status}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {subtitle}
                </Text>
                <Text style={styles.itemMsg} numberOfLines={2}>
                  {item.lastMessage}
                </Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {new Date(item.lastAt).toLocaleString()}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color="#9ca3af" />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bgAlt,
  },
  headerRow: {
    padding: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subtitle: {
    fontSize: 12,
    color: G.textSecondary,
    marginTop: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: G.textPrimary,
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: G.glass3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  loadingText: {
    color: G.textPrimary,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  listEmpty: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyCard: {
    backgroundColor: G.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border3,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: G.textPrimary,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: G.textSecondary,
    lineHeight: 18,
  },
  item: {
    backgroundColor: G.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border3,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: G.glass2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '900',
    color: G.textPrimary,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: G.glass2,
    borderWidth: 1,
    borderColor: G.border3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: G.textPrimary,
  },
  itemSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: G.textSecondary,
  },
  itemMsg: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    color: G.textPrimary,
  },
  itemMeta: {
    marginTop: 6,
    fontSize: 12,
    color: G.textSecondary,
  },
});

export default AdminNeedHelpInboxScreen;
