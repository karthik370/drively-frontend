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
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { updateUser } from '../../redux/slices/authSlice';
import { uploadDriverImage, updateMyProfile } from '../../services/api';
import { UserType } from '../../types';

type PickedImage = { uri: string; mimeType: string; fileName: string; fileSize?: number };

const EditProfileScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const canEditPhoto = user?.userType === UserType.DRIVER || user?.userType === UserType.BOTH;

  const [firstName, setFirstName] = useState(String(user?.firstName || ''));
  const [lastName, setLastName] = useState(String(user?.lastName || ''));
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage ? String(user.profileImage) : null);
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const effectiveImage = pickedImage?.uri ?? profileImage;

  const canSave = useMemo(() => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || fn.length < 2) return false;
    if (!ln || ln.length < 1) return false;
    return true;
  }, [firstName, lastName]);

  const pickPhoto = async () => {
    if (!canEditPhoto) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Photo library permission is required to select a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      setPickedImage({ uri, mimeType: mime, fileName, fileSize });
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Please try again');
    }
  };

  const uploadPickedImage = async (img: PickedImage, kind: string): Promise<string> => {
    try {
      const result = await uploadDriverImage({
        uri: img.uri,
        mimeType: img.mimeType,
        fileName: img.fileName,
        kind,
      });
      return result.fileUrl;
    } catch (e: any) {
      throw new Error(`Upload failed: ${e?.message || 'Please try again'}`);
    }
  };

  const onSave = async () => {
    if (!user) return;
    if (!canSave) {
      Alert.alert('Invalid details', 'Please enter a valid first name and last name.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };

      if (canEditPhoto && pickedImage) {
        payload.profileImage = await uploadPickedImage(pickedImage, 'profile-image');
      }

      const updated = await updateMyProfile(payload);
      dispatch(updateUser(updated as any));
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Please try again');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              {effectiveImage ? (
                <Image source={{ uri: effectiveImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>
                    {String(firstName || 'U').charAt(0).toUpperCase()}
                    {String(lastName || '').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {canEditPhoto ? (
              <TouchableOpacity style={styles.photoBtn} activeOpacity={0.9} onPress={() => void pickPhoto()}>
                <Icon name="camera" size={18} color="#ffffff" />
                <Text style={styles.photoBtnText}>{effectiveImage ? 'Change photo' : 'Add photo'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.label}>First Name *</Text>
          <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} placeholder="First name" />

          <Text style={[styles.label, { marginTop: 12 }]}>Last Name *</Text>
          <TextInput value={lastName} onChangeText={setLastName} style={styles.input} placeholder="Last name" />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || isSaving) && styles.disabled]}
          disabled={!canSave || isSaving}
          activeOpacity={0.9}
          onPress={() => void onSave()}
        >
          {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </ScrollView>
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
  content: { padding: 16, paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#0A0A0A',
  },
  avatarRow: { alignItems: 'center', marginBottom: 14 },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: 'hidden',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarImage: { width: 92, height: 92 },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C9A84C' },
  avatarInitials: { color: '#ffffff', fontWeight: '900', fontSize: 28 },
  photoBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#C9A84C',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  photoBtnText: { color: '#ffffff', fontWeight: '800' },
  label: { color: '#8A8A8A', fontWeight: '800', marginTop: 4 },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: '#111111',
  },
  saveBtn: {
    marginTop: 14,
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.6 },
});

export default EditProfileScreen;
