import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { deleteSavedAddress, getSavedAddresses, type SavedAddress } from '../../services/api';

const SavedAddressesScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });
  }, [items]);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await getSavedAddresses();
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void load();
    });
    void load();
    return unsub;
  }, [navigation]);

  const confirmDelete = (id: string) => {
    Alert.alert('Delete address?', 'Remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsMutating(true);
            try {
              const next = await deleteSavedAddress(id);
              setItems(Array.isArray(next) ? next : []);
            } catch (e: any) {
              Alert.alert('Failed', e?.message || 'Please try again');
            } finally {
              setIsMutating(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <TouchableOpacity
          style={[styles.addBtn, isMutating && styles.disabled]}
          disabled={isMutating}
          onPress={() => navigation.navigate('MapPick', { mode: 'save-address' })}
        >
          <Icon name="plus" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sorted.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No saved addresses</Text>
              <Text style={styles.emptyText}>Tap + to add one from map.</Text>
            </View>
          ) : (
            sorted.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.label} numberOfLines={1}>
                      {a.label ? String(a.label) : 'Saved'}
                    </Text>
                    <Text style={styles.address} numberOfLines={3}>
                      {a.address}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.delBtn, isMutating && styles.disabled]}
                    disabled={isMutating}
                    onPress={() => confirmDelete(a.id)}
                  >
                    <Icon name="trash-can-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, alignItems: 'center' },
  emptyTitle: { fontWeight: '900', color: '#111827', fontSize: 16 },
  emptyText: { marginTop: 6, color: '#6b7280', fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontWeight: '900', color: '#111827' },
  address: { marginTop: 6, color: '#374151', fontWeight: '700' },
  delBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
});

export default SavedAddressesScreen;
