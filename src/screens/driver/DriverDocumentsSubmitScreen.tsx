import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { uploadDriverImage, submitDriverDocuments } from '../../services/api';
import { useAppDispatch } from '../../redux/store';
import { setDriverVerification } from '../../redux/slices/driverSlice';
import { logout } from '../../redux/slices/authSlice';

type PickedImage = { uri: string; mimeType: string; fileName: string; fileSize?: number };

const UploadingOverlay = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulsing icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Bouncing dots
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ])
      );
    animateDot(dot1, 0).start();
    animateDot(dot2, 150).start();
    animateDot(dot3, 300).start();
  }, []);

  const steps = ['Selfie', 'Driving License', 'Aadhaar', 'PAN Card'];

  return (
    <View style={loadingStyles.card}>
      <Animated.View style={[loadingStyles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
        <Icon name="cloud-upload" size={40} color="#C9A84C" />
      </Animated.View>

      <Text style={loadingStyles.title}>Uploading Documents</Text>

      <View style={loadingStyles.dotsRow}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[loadingStyles.dot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>

      <Text style={loadingStyles.subtitle}>Please wait, this may take a moment</Text>

      <View style={loadingStyles.stepsWrap}>
        {steps.map((s, i) => (
          <View key={i} style={loadingStyles.stepRow}>
            <ActivityIndicator size="small" color="#C9A84C" style={{ marginRight: 8 }} />
            <Text style={loadingStyles.stepText}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const loadingStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 16,
    padding: 24,
    marginBottom: 14,
    backgroundColor: '#141414',
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1e3a5f', marginBottom: 8 },
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C9A84C' },
  subtitle: { fontSize: 13, fontWeight: '600', color: '#8A8A8A', marginBottom: 16 },
  stepsWrap: { width: '100%', gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepText: { fontSize: 14, fontWeight: '700', color: '#CCCCCC' },
});


const DriverDocumentsSubmitScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();

  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');

  const [licenseImage, setLicenseImage] = useState<PickedImage | null>(null);
  const [aadhaarImage, setAadhaarImage] = useState<PickedImage | null>(null);
  const [panImage, setPanImage] = useState<PickedImage | null>(null);
  const [profileImage, setProfileImage] = useState<PickedImage | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(
      licenseExpiryDate.trim() &&
      licenseImage &&
      aadhaarImage &&
      panImage &&
      profileImage
    );
  }, [licenseExpiryDate, licenseImage, aadhaarImage, panImage, profileImage]);

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
        allowsEditing: true,
        quality: 0.3,
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
    try {
      console.log(`[${kind}] Uploading image...`);
      const result = await uploadDriverImage({
        uri: img.uri,
        mimeType: img.mimeType,
        fileName: img.fileName,
        kind,
      });
      console.log(`[${kind}] Upload successful.`);
      return result.fileUrl;
    } catch (e: any) {
      console.log(`[${kind}] Upload Error:`, e?.message);
      throw new Error(`[${kind}] Upload failed: ${e?.message || 'Please try again'}`);
    }
  };

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Missing details', 'Please upload selfie + all 3 document photos and fill DL expiry date.');
      return;
    }

    setIsLoading(true);
    try {
      const [selfieUrl, licenseUrl, aadhaarUrl, panUrl] = await Promise.all([
        uploadPickedImage(profileImage as PickedImage, 'driver-selfie'),
        uploadPickedImage(licenseImage as PickedImage, 'driver-license'),
        uploadPickedImage(aadhaarImage as PickedImage, 'driver-aadhaar'),
        uploadPickedImage(panImage as PickedImage, 'driver-pan'),
      ]);

      const status = await submitDriverDocuments({
        licenseExpiryDate: licenseExpiryDate.trim(),
        licenseImageUrl: licenseUrl,
        aadhaarImageUrl: aadhaarUrl,
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
      } catch { }
    } catch (e: any) {
      Alert.alert('Submit failed', e?.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPhotoCard = (
    title: string,
    subtitle: string,
    icon: string,
    image: PickedImage | null,
    setImage: (img: PickedImage) => void
  ) => (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.instruction}>{subtitle}</Text>

      <TouchableOpacity
        style={styles.uploadRow}
        activeOpacity={0.85}
        onPress={() => pickImage(setImage)}
      >
        <View style={styles.uploadLeft}>
          <Icon name={icon as any} size={22} color="#C9A84C" />
          <Text style={styles.uploadText}>{image ? 'Retake photo' : 'Take photo'}</Text>
        </View>
        {image ? (
          <Icon name="check-circle" size={22} color="#10b981" />
        ) : (
          <Icon name="chevron-right" size={22} color="#9ca3af" />
        )}
      </TouchableOpacity>

      {image ? <Image source={{ uri: image.uri }} style={styles.preview} /> : null}
    </View>
  );

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
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.instruction}>1. Take photo in good light, no blur.</Text>
          <Text style={styles.instruction}>2. Keep the document flat and fill the frame.</Text>
          <Text style={styles.instruction}>3. Admin will verify details from the photos.</Text>
        </View>

        {renderPhotoCard(
          'Selfie (Profile Photo)',
          'Take a clear selfie. This will be shown to customers.',
          'account',
          profileImage,
          setProfileImage
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driving License</Text>
          <Text style={styles.instruction}>Take a clear photo of your driving license.</Text>

          <Text style={styles.label}>Expiry Date (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2030-12-31"
            value={licenseExpiryDate}
            onChangeText={setLicenseExpiryDate}
            autoCapitalize="none"
            placeholderTextColor="#444444"
          />

          <TouchableOpacity
            style={styles.uploadRow}
            activeOpacity={0.85}
            onPress={() => pickImage((u) => setLicenseImage(u))}
          >
            <View style={styles.uploadLeft}>
              <Icon name="card-account-details" size={22} color="#C9A84C" />
              <Text style={styles.uploadText}>{licenseImage ? 'Retake photo' : 'Take photo'}</Text>
            </View>
            {licenseImage ? (
              <Icon name="check-circle" size={22} color="#10b981" />
            ) : (
              <Icon name="chevron-right" size={22} color="#9ca3af" />
            )}
          </TouchableOpacity>

          {licenseImage ? <Image source={{ uri: licenseImage.uri }} style={styles.preview} /> : null}
        </View>

        {renderPhotoCard(
          'Aadhaar Card',
          'Take a clear photo of your Aadhaar card.',
          'card-account-details-outline',
          aadhaarImage,
          setAadhaarImage
        )}

        {renderPhotoCard(
          'PAN Card',
          'Take a clear photo of your PAN card.',
          'card-account-details',
          panImage,
          setPanImage
        )}

        {isLoading ? <UploadingOverlay /> : null}

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
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  logoutText: { marginLeft: 6, color: '#ef4444', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 28 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#0A0A0A',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 10 },
  instruction: { color: '#CCCCCC', marginBottom: 6, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: '#CCCCCC', marginTop: 6, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  uploadRow: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111',
  },
  uploadLeft: { flexDirection: 'row', alignItems: 'center' },
  uploadText: { marginLeft: 10, fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  preview: { width: '100%', height: 190, borderRadius: 12, marginTop: 12, backgroundColor: '#141414' },
  submitButton: {
    marginTop: 8,
    backgroundColor: '#C9A84C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.55 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  loadingCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    padding: 24,
    marginBottom: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
  },
  loadingText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginTop: 12 },
  loadingSubtext: { fontSize: 13, fontWeight: '600', color: '#8A8A8A', marginTop: 6 },
});

export default DriverDocumentsSubmitScreen;
