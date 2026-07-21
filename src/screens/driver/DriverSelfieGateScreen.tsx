/**
 * DriverSelfieGateScreen
 * ──────────────────────
 * Shown ONLY when:
 *   1. KYC is fully approved (documentsVerified = true) AND
 *   2. user.profileImage is null/empty (Didit auto-extraction failed)
 *
 * Blocks the driver from reaching the home screen until a selfie is captured
 * and successfully uploaded to Cloudinary.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { loadUser } from '../../redux/slices/authSlice';
import { uploadDriverImage, updateMyProfile } from '../../services/api';

const DriverSelfieGateScreen = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // ── Open camera ────────────────────────────────────────────────────────────
  const handleTakePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take your profile selfie.'
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        cameraType: ImagePicker.CameraType.front, // front camera for selfie
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e?.message || 'Could not open camera.');
    }
  }, []);

  // ── Upload & unlock home screen ────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!photoUri) return;
    setUploading(true);
    try {
      // Upload selfie → Cloudinary via backend
      const uploaded = await uploadDriverImage({
        uri: photoUri,
        mimeType: 'image/jpeg',
        fileName: `selfie_gate_${Date.now()}.jpg`,
        kind: 'profile',
      });

      if (!uploaded?.fileUrl) {
        throw new Error('Upload succeeded but no URL returned.');
      }

      // Persist as profileImage on the user record
      await updateMyProfile({
        firstName: user?.firstName || '',
        lastName:  user?.lastName  || '',
        profileImage: uploaded.fileUrl,
      });

      // Refresh Redux — this triggers re-render in MainNavigator:
      //   user.profileImage is now set → gate condition cleared → home screen shown
      await dispatch(loadUser());

      // (No navigation call needed — MainNavigator re-evaluates automatically)
    } catch (e: any) {
      setRetryCount((n) => n + 1);
      Alert.alert(
        'Upload Failed',
        e?.message || 'Could not upload your photo. Please try again.',
        [{ text: 'Try Again', onPress: () => setPhotoUri(null) }]
      );
    } finally {
      setUploading(false);
    }
  }, [photoUri, user, dispatch]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Icon name="camera-account" size={42} color="#C9A84C" />
          </View>
          <Text style={styles.title}>One Last Step</Text>
          <Text style={styles.subtitle}>
            Your KYC is verified! We just need a profile selfie to complete your onboarding.
          </Text>
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Icon name="information-outline" size={18} color="#60a5fa" style={{ marginTop: 2 }} />
          <Text style={styles.infoText}>
            Your selfie will be visible to customers during trips. Use a clear, front-facing photo in good lighting.
          </Text>
        </View>

        {/* Preview / placeholder */}
        {photoUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: photoUri }} style={styles.preview} />
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setPhotoUri(null)}>
              <Icon name="camera-retake" size={16} color="#94a3b8" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.placeholder} onPress={handleTakePhoto} activeOpacity={0.8}>
            <Icon name="camera-plus-outline" size={48} color="#475569" />
            <Text style={styles.placeholderText}>Tap to take selfie</Text>
          </TouchableOpacity>
        )}

        {/* Action buttons */}
        {!photoUri ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
            <Icon name="camera" size={20} color="#000" />
            <Text style={styles.primaryBtnText}>Open Camera</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, uploading && styles.disabledBtn]}
            onPress={handleUpload}
            activeOpacity={0.85}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Icon name="check-circle" size={20} color="#000" />
            )}
            <Text style={styles.primaryBtnText}>
              {uploading ? 'Uploading...' : 'Save & Continue'}
            </Text>
          </TouchableOpacity>
        )}

        {retryCount > 0 && (
          <Text style={styles.retryHint}>
            Having trouble? Make sure you have a stable internet connection.
          </Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C9A84C33',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#93c5fd',
    lineHeight: 19,
  },
  placeholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#475569',
  },
  previewWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#C9A84C',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 6,
  },
  retakeText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#C9A84C',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
    width: '100%',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  retryHint: {
    marginTop: 16,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default DriverSelfieGateScreen;
