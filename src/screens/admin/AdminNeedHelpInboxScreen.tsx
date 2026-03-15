import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { listSupportThreads, type SupportThread } from '../../services/api';

const AdminNeedHelpInboxScreen = ({ navigation }: any) => {
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
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="headset" size={22} color="#C9A84C" />
          <Text style={styles.title}>Need Help</Text>
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
        data={threads}
        keyExtractor={(item) => `${item.bookingId}:${item.threadUserId}`}
        contentContainerStyle={threads.length ? styles.list : styles.listEmpty}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No help requests</Text>
              <Text style={styles.emptySub}>When customers or drivers tap “Need Help”, chats will appear here.</Text>
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
          const subtitle = `${senderName} • ${senderRole}`;

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
              <View style={styles.itemIcon}>
                <Icon name="chat-processing" size={18} color="#1e40af" />
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
    backgroundColor: '#111111',
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
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  loadingText: {
    color: '#FFFFFF',
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
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: '#8A8A8A',
    lineHeight: 18,
  },
  item: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#141414',
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
    color: '#FFFFFF',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  itemSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8A8A',
  },
  itemMsg: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  itemMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#8A8A8A',
  },
});

export default AdminNeedHelpInboxScreen;
