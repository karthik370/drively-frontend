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
          <Icon name="arrow-left" size={22} color="#C9A84C" />
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
          <ActivityIndicator size="large" color="#C9A84C" />
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
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, alignItems: 'center' },
  emptyTitle: { fontWeight: '900', color: '#FFFFFF', fontSize: 16 },
  emptyText: { marginTop: 6, color: '#8A8A8A', fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontWeight: '900', color: '#FFFFFF' },
  address: { marginTop: 6, color: '#CCCCCC', fontWeight: '700' },
  delBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: 'rgba(255,68,68,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
});

export default SavedAddressesScreen;
