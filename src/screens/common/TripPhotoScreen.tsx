/**
 * TripPhotoScreen — Capture before/after trip photos
 * ──────────────────────────────────────────────────
 * 4 photos per phase: front, back, left, right
 * GPS-tagged + timestamped, uploaded to Cloudinary
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  ActivityIndicator, ScrollView, InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { uploadTripPhoto, getTripPhotos } from '../../services/api';
import { G } from '../../constants/glassStyles';

const LABELS = ['front', 'back', 'left', 'right'] as const;
const LABEL_ICONS: Record<string, string> = {
  front: 'car-side',
  back: 'car-back',
  left: 'car-door',
  right: 'car-door',
};
const LABEL_DISPLAY: Record<string, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left Side',
  right: 'Right Side',
};

interface PhotoSlot {
  label: string;
  uri: string | null;
  uploading: boolean;
  uploaded: boolean;
  imageUrl?: string;
}

const TripPhotoScreen = ({ navigation, route }: any) => {
  const { bookingId, phase } = route.params || {};
  const [screenReady, setScreenReady] = useState(false);
  const [photos, setPhotos] = useState<PhotoSlot[]>(
    LABELS.map(label => ({ label, uri: null, uploading: false, uploaded: false }))
  );
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setScreenReady(true));
    return () => handle.cancel();
  }, []);

  // Load existing photos
  useEffect(() => {
    if (!screenReady || !bookingId) return;
    void (async () => {
      try {
        const data = await getTripPhotos(bookingId);
        const existing = phase === 'BEFORE' ? data?.before : data?.after;
        if (Array.isArray(existing)) {
          setPhotos(prev => prev.map(slot => {
            const match = existing.find((p: any) => p.label === slot.label);
            if (match) {
              return { ...slot, uri: match.imageUrl, uploaded: true, imageUrl: match.imageUrl };
            }
            return slot;
          }));
        }
      } catch { }
      setLoadingExisting(false);
    })();
  }, [screenReady, bookingId, phase]);

  const takePhoto = useCallback(async (index: number) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, uri, uploading: true } : p));

    try {
      // Read as base64
      const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });

      // Get GPS
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      } catch { }

      await uploadTripPhoto({
        bookingId,
        base64: base64Data,
        mimeType: 'image/jpeg',
        phase,
        label: LABELS[index],
        latitude: lat,
        longitude: lng,
      });

      setPhotos(prev => prev.map((p, i) => i === index ? { ...p, uploading: false, uploaded: true } : p));
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Failed to upload photo');
      setPhotos(prev => prev.map((p, i) => i === index ? { ...p, uploading: false } : p));
    }
  }, [bookingId, phase]);

  const allDone = photos.every(p => p.uploaded);

  if (!screenReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#C9A84C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {phase === 'BEFORE' ? '📸 Before Trip Photos' : '📸 After Trip Photos'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Icon name="information-outline" size={20} color="#C9A84C" />
          <Text style={styles.infoText}>
            Take 4 photos of the car from all sides. Photos are timestamped and GPS-tagged for dispute evidence.
          </Text>
        </View>

        <View style={styles.grid}>
          {photos.map((slot, index) => (
            <TouchableOpacity
              key={slot.label}
              style={[styles.photoSlot, slot.uploaded && styles.photoSlotDone]}
              onPress={() => !slot.uploaded && takePhoto(index)}
              disabled={slot.uploading}
            >
              {slot.uri ? (
                <Image source={{ uri: slot.uri }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Icon name={LABEL_ICONS[slot.label] || 'camera'} size={32} color="#666" />
                </View>
              )}

              {slot.uploading && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.uploadText}>Uploading…</Text>
                </View>
              )}

              {slot.uploaded && (
                <View style={styles.uploadedBadge}>
                  <Icon name="check-circle" size={20} color="#10b981" />
                </View>
              )}

              <View style={styles.labelBar}>
                <Text style={styles.labelText}>{LABEL_DISPLAY[slot.label]}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {allDone && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Icon name="check-all" size={20} color="#fff" />
            <Text style={styles.doneBtnText}>All Photos Captured ✓</Text>
          </TouchableOpacity>
        )}

        {!allDone && !loadingExisting && (
          <Text style={styles.hint}>
            Tap each slot to take a photo. {photos.filter(p => p.uploaded).length}/4 done.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: G.border3,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: G.textPrimary },
  content: { padding: 16 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: G.glass1, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: G.border3, marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, color: G.textSecondary, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoSlot: {
    width: '47%', aspectRatio: 1, borderRadius: 16,
    backgroundColor: G.glass2, borderWidth: 2, borderColor: G.border3,
    overflow: 'hidden', position: 'relative',
  },
  photoSlotDone: { borderColor: '#10b981' },
  photoPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  uploadText: { color: '#fff', fontSize: 12, marginTop: 4 },
  uploadedBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 2,
  },
  labelBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingVertical: 6, alignItems: 'center',
  },
  labelText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 14, marginTop: 24,
  },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  hint: {
    textAlign: 'center', color: G.textSecondary, fontSize: 13, marginTop: 20,
  },
});

export default TripPhotoScreen;
