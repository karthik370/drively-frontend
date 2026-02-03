import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { GOOGLE_MAPS_API_KEY } from '../../constants/config';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setDropAddress, setDropLocation, setPickupAddress, setPickupLocation } from '../../redux/slices/locationSlice';
import { getSavedAddresses, type SavedAddress } from '../../services/api';

type Props = {
  navigation: any;
  route: any;
};

type Target = 'pickup' | 'drop';

type PlacePrediction = {
  description: string;
  place_id: string;
};

type SearchRow =
  | { kind: 'saved'; key: string; item: SavedAddress }
  | { kind: 'place'; key: string; item: PlacePrediction };

const LocationSearchScreen = ({ navigation, route }: Props) => {
  const dispatch = useAppDispatch();
  const { userLocation } = useAppSelector((s) => s.location);

  const target: Target = route?.params?.target === 'drop' ? 'drop' : 'pickup';
  const initialValue: string = route?.params?.initialValue ?? '';

  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  const locationBias = useMemo(() => {
    if (!userLocation) return null;
    return `${userLocation.latitude},${userLocation.longitude}`;
  }, [userLocation]);

  useEffect(() => {
    let alive = true;

    const fetchPredictions = async () => {
      if (!GOOGLE_MAPS_API_KEY) {
        setPredictions([]);
        return;
      }

      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setPredictions([]);
        return;
      }

      setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('input', trimmed);
        params.set('key', GOOGLE_MAPS_API_KEY);
        params.set('language', 'en');
        params.set('components', 'country:in');

        if (locationBias) {
          params.set('location', locationBias);
          params.set('radius', '50000');
        }

        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
        const res = await fetch(url);
        const json = await res.json();

        if (!alive) return;

        const items: PlacePrediction[] = Array.isArray(json?.predictions)
          ? json.predictions.map((p: any) => ({
              description: p?.description ?? '',
              place_id: p?.place_id ?? '',
            }))
          : [];

        setPredictions(items.filter((p) => p.description && p.place_id));
      } catch {
        if (!alive) return;
        setPredictions([]);
      } finally {
        if (!alive) return;
        setIsLoading(false);
      }
    };

    const t = setTimeout(fetchPredictions, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, locationBias]);

  const pickSaved = (saved: SavedAddress) => {
    const lat = saved?.location?.latitude;
    const lng = saved?.location?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const address = saved.address;

    if (target === 'pickup') {
      dispatch(setPickupLocation({ latitude: lat, longitude: lng }));
      dispatch(setPickupAddress(address));
    } else {
      dispatch(setDropLocation({ latitude: lat, longitude: lng }));
      dispatch(setDropAddress(address));
    }

    navigation.goBack();
  };

  const filteredSaved = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedAddresses;
    return savedAddresses.filter((a) => {
      const text = `${a.label ?? ''} ${a.address ?? ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [query, savedAddresses]);

  const rows: SearchRow[] = useMemo(() => {
    const savedRows = filteredSaved.map((a) => ({ kind: 'saved', key: `saved:${a.id}`, item: a } as const));
    const placeRows = predictions.map((p) => ({ kind: 'place', key: `place:${p.place_id}`, item: p } as const));
    return [...savedRows, ...placeRows];
  }, [filteredSaved, predictions]);

  useEffect(() => {
    let alive = true;

    const loadSaved = async () => {
      try {
        const res = await getSavedAddresses();
        if (!alive) return;
        setSavedAddresses(Array.isArray(res) ? res : []);
      } catch {
        if (!alive) return;
        setSavedAddresses([]);
      }
    };

    void loadSaved();

    const unsub = navigation.addListener('focus', () => {
      void loadSaved();
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [navigation]);

  const pickPlace = async (placeId: string) => {
    if (!GOOGLE_MAPS_API_KEY) return;

    setIsSelecting(true);
    try {
      const params = new URLSearchParams();
      params.set('place_id', placeId);
      params.set('fields', 'geometry,formatted_address,name');
      params.set('key', GOOGLE_MAPS_API_KEY);

      const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();

      const loc = json?.result?.geometry?.location;
      const lat = typeof loc?.lat === 'number' ? loc.lat : null;
      const lng = typeof loc?.lng === 'number' ? loc.lng : null;

      const address =
        (json?.result?.formatted_address as string | undefined) ??
        (json?.result?.name as string | undefined) ??
        null;

      if (lat == null || lng == null) return;

      if (target === 'pickup') {
        dispatch(setPickupLocation({ latitude: lat, longitude: lng }));
        dispatch(setPickupAddress(address));
      } else {
        dispatch(setDropLocation({ latitude: lat, longitude: lng }));
        dispatch(setDropAddress(address));
      }

      navigation.goBack();
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{target === 'pickup' ? 'Pickup location' : 'Drop location'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchBox}>
        <Icon name="magnify" size={20} color="#6b7280" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={target === 'pickup' ? 'Search pickup location' : 'Search drop location'}
          placeholderTextColor="#9ca3af"
          style={styles.input}
          autoFocus
        />
        {isLoading ? <ActivityIndicator size="small" color="#2563eb" /> : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          if (item.kind === 'saved') {
            const saved = item.item;
            const title = saved.label ? String(saved.label) : 'Saved';
            return (
              <TouchableOpacity
                disabled={isSelecting}
                style={styles.row}
                onPress={() => {
                  pickSaved(saved);
                }}
              >
                <Icon name="bookmark" size={18} color="#10b981" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.savedTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.rowText} numberOfLines={2}>
                    {saved.address}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }

          const place = item.item;
          return (
            <TouchableOpacity
              disabled={isSelecting}
              style={styles.row}
              onPress={() => {
                pickPlace(place.place_id);
              }}
            >
              <Icon name="map-marker" size={18} color="#2563eb" />
              <Text style={styles.rowText} numberOfLines={2}>
                {place.description}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          query.trim().length < 2 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{savedAddresses.length ? 'Saved addresses will appear here' : 'Type at least 2 characters'}</Text>
            </View>
          ) : isLoading ? null : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No results</Text>
            </View>
          )
        }
      />

      {isSelecting ? (
        <View style={styles.selectingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.selectingText}>Selecting location...</Text>
        </View>
      ) : null}
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  savedTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  rowText: { flex: 1, fontSize: 14, color: '#111827' },
  emptyState: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 14 },
  selectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  selectingText: { color: '#111827', fontWeight: '600' },
});

export default LocationSearchScreen;
