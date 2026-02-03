import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { presignDriverUpload, submitDriverDocuments } from '../../services/api';
import { useAppDispatch } from '../../redux/store';
import { setDriverVerification } from '../../redux/slices/driverSlice';
import { logout } from '../../redux/slices/authSlice';

type PickedImage = { uri: string; mimeType: string; fileName: string; fileSize?: number };

const DriverDocumentsSubmitScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();

  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');

  const [licenseImage, setLicenseImage] = useState<PickedImage | null>(null);
  const [aadhaarImage, setAadhaarImage] = useState<PickedImage | null>(null);
  const [panImage, setPanImage] = useState<PickedImage | null>(null);
  const [profileImage, setProfileImage] = useState<PickedImage | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(
      licenseNumber.trim() &&
        licenseExpiryDate.trim() &&
        aadhaarNumber.trim() &&
        panNumber.trim() &&
        licenseImage &&
        aadhaarImage &&
        panImage &&
        profileImage
    );
  }, [licenseNumber, licenseExpiryDate, aadhaarNumber, panNumber, licenseImage, aadhaarImage, panImage, profileImage]);

  const pickImage = async (onPicked: (img: PickedImage) => void) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Camera permission is required to upload documents.');
        return;
      }

      const mediaTypes =
        (ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: mediaTypes as any,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      const uri = asset?.uri;
      if (!uri) {
        Alert.alert('Upload failed', 'Could not read image. Please try again.');
        return;
      }

      const mime = asset?.mimeType || 'image/jpeg';
      const fileName = (typeof asset?.fileName === 'string' && asset.fileName.trim()) ? asset.fileName.trim() : uri.split('/').pop() || `image-${Date.now()}.jpg`;
      const fileSize = typeof (asset as any)?.fileSize === 'number' ? (asset as any).fileSize : undefined;
      onPicked({ uri, mimeType: mime, fileName, fileSize });
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    }
  };

  const uploadPickedImage = async (img: PickedImage, kind: string): Promise<string> => {
    let presign: { uploadUrl: string; fileUrl: string };
    try {
      presign = await presignDriverUpload({
        fileName: img.fileName,
        contentType: img.mimeType,
        fileSize: img.fileSize,
        kind,
      });
    } catch (e: any) {
      throw new Error(`[${kind}] Presign failed: ${e?.message || 'Please try again'}`);
    }

    const uploadType = (FileSystem as any).FileSystemUploadType?.BINARY_CONTENT;
    let uploadRes: any;
    try {
      uploadRes = await FileSystem.uploadAsync(
        presign.uploadUrl,
        img.uri,
        {
          httpMethod: 'PUT',
          ...(uploadType ? { uploadType } : null),
          headers: {
            'Content-Type': img.mimeType,
          },
        } as any
      );
    } catch (e: any) {
      const target = typeof presign.uploadUrl === 'string' ? presign.uploadUrl.split('?')[0] : '';
      const where = target ? ` to ${target}` : '';
      throw new Error(`[${kind}] Upload failed${where}: ${e?.message || 'Network error'}`);
    }

    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      const body = typeof uploadRes.body === 'string' ? uploadRes.body : '';
      const detail = body ? `: ${body.slice(0, 300)}` : '';
      const target = typeof presign.uploadUrl === 'string' ? presign.uploadUrl.split('?')[0] : '';
      const where = target ? ` to ${target}` : '';
      throw new Error(`[${kind}] Image upload failed (${uploadRes.status})${where}${detail}`);
    }

    return presign.fileUrl;
  };

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Missing details', 'Please upload selfie + all 3 documents and fill all numbers.');
      return;
    }

    setIsLoading(true);
    try {
      const selfieUrl = await uploadPickedImage(profileImage as PickedImage, 'driver-selfie');
      const licenseUrl = await uploadPickedImage(licenseImage as PickedImage, 'driver-license');
      const aadhaarUrl = await uploadPickedImage(aadhaarImage as PickedImage, 'driver-aadhaar');
      const panUrl = await uploadPickedImage(panImage as PickedImage, 'driver-pan');

      const status = await submitDriverDocuments({
        licenseNumber: licenseNumber.trim(),
        licenseExpiryDate: licenseExpiryDate.trim(),
        licenseImageUrl: licenseUrl,
        aadhaarNumber: aadhaarNumber.trim(),
        aadhaarImageUrl: aadhaarUrl,
        panNumber: panNumber.trim().toUpperCase(),
        panImageUrl: panUrl,
        profileImage: selfieUrl,
      });

      dispatch(
        setDriverVerification({
          documentsVerified: status.documentsVerified,
          backgroundCheckStatus: status.backgroundCheckStatus,
          submitted: status.submitted,
          updatedAt: status.updatedAt,
          reason: null,
        })
      );

      try {
        navigation.replace('DriverVerificationPending');
      } catch {
      }
    } catch (e: any) {
      Alert.alert('Submit failed', e?.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Verification</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            dispatch(logout());
          }}
        >
          <Icon name="logout" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Important instructions</Text>
          <Text style={styles.instruction}>1. Take photo in good light, no blur, no cut corners.</Text>
          <Text style={styles.instruction}>2. Keep the document flat and fill the frame.</Text>
          <Text style={styles.instruction}>3. Numbers must match the photo exactly.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Selfie (Profile Photo)</Text>
          <Text style={styles.instruction}>Take a clear selfie. This will be shown to customers.</Text>

          <TouchableOpacity
            style={styles.uploadRow}
            activeOpacity={0.85}
            onPress={() => pickImage((u) => setProfileImage(u))}
          >
            <View style={styles.uploadLeft}>
              <Icon name="account" size={22} color="#2563eb" />
              <Text style={styles.uploadText}>{profileImage ? 'Retake selfie' : 'Take selfie'}</Text>
            </View>
            <Icon name="chevron-right" size={22} color="#9ca3af" />
          </TouchableOpacity>

          {profileImage ? <Image source={{ uri: profileImage.uri }} style={styles.preview} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driving License</Text>

          <Text style={styles.label}>License Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. TS09 2020 0001234"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Expiry Date (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2030-12-31"
            value={licenseExpiryDate}
            onChangeText={setLicenseExpiryDate}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.uploadRow}
            activeOpacity={0.85}
            onPress={() => pickImage((u) => setLicenseImage(u))}
          >
            <View style={styles.uploadLeft}>
              <Icon name="card-account-details" size={22} color="#2563eb" />
              <Text style={styles.uploadText}>{licenseImage ? 'Retake photo' : 'Take photo'}</Text>
            </View>
            <Icon name="chevron-right" size={22} color="#9ca3af" />
          </TouchableOpacity>

          {licenseImage ? <Image source={{ uri: licenseImage.uri }} style={styles.preview} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Aadhaar</Text>

          <Text style={styles.label}>Aadhaar Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="12 digits"
            value={aadhaarNumber}
            onChangeText={setAadhaarNumber}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={styles.uploadRow}
            activeOpacity={0.85}
            onPress={() => pickImage((u) => setAadhaarImage(u))}
          >
            <View style={styles.uploadLeft}>
              <Icon name="card-account-details-outline" size={22} color="#2563eb" />
              <Text style={styles.uploadText}>{aadhaarImage ? 'Retake photo' : 'Take photo'}</Text>
            </View>
            <Icon name="chevron-right" size={22} color="#9ca3af" />
          </TouchableOpacity>

          {aadhaarImage ? <Image source={{ uri: aadhaarImage.uri }} style={styles.preview} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PAN</Text>

          <Text style={styles.label}>PAN Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="ABCDE1234F"
            value={panNumber}
            onChangeText={setPanNumber}
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={styles.uploadRow}
            activeOpacity={0.85}
            onPress={() => pickImage((u) => setPanImage(u))}
          >
            <View style={styles.uploadLeft}>
              <Icon name="card-account-details" size={22} color="#2563eb" />
              <Text style={styles.uploadText}>{panImage ? 'Retake photo' : 'Take photo'}</Text>
            </View>
            <Icon name="chevron-right" size={22} color="#9ca3af" />
          </TouchableOpacity>

          {panImage ? <Image source={{ uri: panImage.uri }} style={styles.preview} /> : null}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || isLoading) && styles.submitButtonDisabled]}
          activeOpacity={0.9}
          disabled={!canSubmit || isLoading}
          onPress={onSubmit}
        >
          {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitText}>Submit for verification</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  logoutText: { marginLeft: 6, color: '#ef4444', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 28 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#ffffff',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 10 },
  instruction: { color: '#374151', marginBottom: 6, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 6, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  uploadRow: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
  },
  uploadLeft: { flexDirection: 'row', alignItems: 'center' },
  uploadText: { marginLeft: 10, fontSize: 14, fontWeight: '700', color: '#111827' },
  preview: { width: '100%', height: 190, borderRadius: 12, marginTop: 12, backgroundColor: '#f3f4f6' },
  submitButton: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.55 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
});

export default DriverDocumentsSubmitScreen;
