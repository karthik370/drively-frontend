import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { listActivePromotions, Promotion } from '../../services/api';

const PromoCodesScreen = ({ navigation, route }: any) => {
  const onSelect = route?.params?.onSelect as ((code: string) => void) | undefined;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Promotion[]>([]);

  const title = useMemo(() => (typeof onSelect === 'function' ? 'Select Promo Code' : 'Promo Codes'), [onSelect]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listActivePromotions()
      .then((p) => {
        if (!alive) return;
        setItems(p);
      })
      .catch((e: any) => {
        if (!alive) return;
        Alert.alert('Promos', e?.message || 'Failed to load promo codes');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.centerText}>Loading promo codes…</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.center}>
            <Icon name="ticket-percent" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No promo codes</Text>
            <Text style={styles.emptySubtitle}>Check back later for offers.</Text>
          </View>
        ) : null}

        {items.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            onPress={() => {
              if (typeof onSelect === 'function') {
                onSelect(p.code);
                navigation.goBack();
              }
            }}
          >
            <View style={styles.cardRow}>
              <View style={styles.badge}>
                <Icon name="ticket-percent" size={18} color="#2563eb" />
                <Text style={styles.code}>{p.code}</Text>
              </View>
              {typeof onSelect === 'function' ? <Icon name="chevron-right" size={22} color="#9ca3af" /> : null}
            </View>
            {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Min order: ₹{Number(p.minOrderValue || 0)}</Text>
              <Text style={styles.metaText}>Expires: {new Date(p.validUntil).toLocaleDateString()}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 24 },
  center: { alignItems: 'center', paddingVertical: 30 },
  centerText: { marginTop: 10, color: '#111827', fontWeight: '600' },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#111827' },
  emptySubtitle: { marginTop: 6, fontSize: 13, color: '#6b7280' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  code: { color: '#1d4ed8', fontWeight: '900' },
  desc: { marginTop: 10, color: '#111827', fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { color: '#6b7280', fontWeight: '600', fontSize: 12 },
});

export default PromoCodesScreen;
