import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppSelector } from '../../redux/store';
import { addSavedAddress, reverseGeocodeLocation } from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

type Mode = 'save-address' | 'pick-only';

const MapPickScreen = ({ navigation, route }: any) => {
  const userLocation = useAppSelector((s) => s.location.userLocation);
  const mode: Mode = route?.params?.mode === 'pick-only' ? 'pick-only' : 'save-address';

  const initialRegion: Region = useMemo(() => {
    const lat = userLocation?.latitude ?? 17.385;
    const lng = userLocation?.longitude ?? 78.4867;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
  }, [userLocation?.latitude, userLocation?.longitude]);

  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [formatted, setFormatted] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setRegion(initialRegion);
  }, [initialRegion]);

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      setIsLoadingAddress(true);
      try {
        const res = await reverseGeocodeLocation(region.latitude, region.longitude);
        if (!alive) return;
        setFormatted(String((res as any)?.formatted_address || ''));
      } catch {
        if (!alive) return;
        setFormatted('');
      } finally {
        if (!alive) return;
        setIsLoadingAddress(false);
      }
    };

    t = setTimeout(run, 500);
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [region.latitude, region.longitude]);

  const onSave = async () => {
    if (mode !== 'save-address') {
      navigation.goBack();
      return;
    }

    const address = formatted.trim();
    if (!address) {
      showAlert('Address not ready', 'Please wait for address to load.');
      return;
    }

    setIsSaving(true);
    try {
      await addSavedAddress({
        label: label.trim() ? label.trim() : undefined,
        address,
        latitude: region.latitude,
        longitude: region.longitude,
      });
      navigation.goBack();
    } catch (e: any) {
      showAlert('Failed', e?.message || 'Please try again');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top','bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pick location</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          onRegionChangeComplete={(r) => setRegion(r)}
        />

        <View style={styles.pinWrap} pointerEvents="none">
          <Icon name="map-marker" size={44} color="#ef4444" />
        </View>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.value} numberOfLines={2}>
          {isLoadingAddress ? 'Loading…' : formatted || '—'}
        </Text>

        {mode === 'save-address' ? (
          <>
            <Text style={[styles.label, { marginTop: 10 }]}>Label (optional)</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Home / Work"
              style={styles.input}
            />
          </>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, (isSaving || isLoadingAddress) && styles.disabled]}
          disabled={isSaving || isLoadingAddress}
          activeOpacity={0.9}
          onPress={() => void onSave()}
        >
          {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>{mode === 'save-address' ? 'Save address' : 'Use location'}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: G.glass2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: G.border3,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
  mapWrap: { flex: 1 },
  pinWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    alignItems: 'center',
    marginTop: -44,
  },
  sheet: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    backgroundColor: G.bg,
  },
  label: { color: G.textSecondary, fontWeight: '800' },
  value: { marginTop: 6, color: G.textPrimary, fontWeight: '800' },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: G.textPrimary,
    backgroundColor: G.bgAlt,
  },
  saveBtn: {
    marginTop: 12,
    backgroundColor: G.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: G.textPrimary, fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.6 },
});

export default MapPickScreen;
