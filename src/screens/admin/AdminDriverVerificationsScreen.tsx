import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getPendingDriverVerifications, PendingDriverVerificationItem } from '../../services/api';

const AdminDriverVerificationsScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<PendingDriverVerificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getPendingDriverVerifications();
    setItems(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        await load();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Verifications</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => void onRefresh()}>
          <Icon name="refresh" size={20} color="#C9A84C" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#C9A84C" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.driverId)}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} />}
          contentContainerStyle={items.length ? styles.list : styles.center}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('AdminDriverVerificationDetail', { driverId: item.driverId })}
            >
              <View style={styles.rowLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{String(item.name || 'D').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.phone} numberOfLines={1}>
                    {item.phoneNumber}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={22} color="#9ca3af" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="shield-check" size={40} color="#10b981" />
              <Text style={styles.emptyTitle}>No pending verifications</Text>
              <Text style={styles.emptySub}>All driver documents are verified or no one has submitted yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  title: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  refreshBtn: { padding: 10 },
  list: { padding: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  row: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontWeight: '900', fontSize: 18 },
  meta: { marginLeft: 12, flex: 1, minWidth: 0 },
  name: { fontWeight: '900', color: '#FFFFFF', fontSize: 15 },
  phone: { marginTop: 2, color: '#8A8A8A', fontWeight: '700' },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  emptySub: { marginTop: 6, textAlign: 'center', color: '#8A8A8A', fontWeight: '600' },
});

export default AdminDriverVerificationsScreen;
