import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {
  getDriverVerificationDetails,
  DriverVerificationDetails,
  verifyDriverDocuments,
} from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const AdminDriverVerificationDetailScreen = ({ route, navigation }: any) => {
  const driverId = String(route?.params?.driverId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [details, setDetails] = useState<DriverVerificationDetails | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isExperienced, setIsExperienced] = useState(false);

  const load = useCallback(async () => {
    const data = await getDriverVerificationDetails(driverId);
    setDetails(data);
  }, [driverId]);

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        await load();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [load]);

  const approve = async (approved: boolean) => {
    if (!driverId) return;

    if (!approved) {
      showAlert('Reject driver', 'Are you sure you want to reject this driver?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const r = rejectReason.trim();
              setIsSubmitting(true);
              try {
                await verifyDriverDocuments(driverId, false, r || undefined, isExperienced);
                await load();
                navigation.goBack();
              } catch (e: any) {
                showAlert('Failed', e?.message || 'Please try again');
              } finally {
                setIsSubmitting(false);
              }
            })();
          },
        },
      ]);
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyDriverDocuments(driverId, true, undefined, isExperienced);
      await load();
      navigation.goBack();
    } catch (e: any) {
      showAlert('Failed', e?.message || 'Please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top','bottom']} style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#C9A84C" />
        </View>
      </SafeAreaView>
    );
  }

  if (!details) {
    return (
      <SafeAreaView edges={['top','bottom']} style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Driver not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {details.user.firstName} {details.user.lastName}
        </Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.kvTitle}>Phone</Text>
          <Text style={styles.kvValue}>{details.user.phoneNumber}</Text>
          <Text style={[styles.kvTitle, { marginTop: 10 }]}>Status</Text>
          <Text style={styles.kvValue}>{String(details.backgroundCheckStatus)}</Text>
        </View>

        {details.user.profileImage ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Selfie</Text>
            <Image source={{ uri: String(details.user.profileImage) }} style={styles.preview} />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driving License</Text>
          <Text style={styles.kvTitle}>Number</Text>
          <Text style={styles.kvValue}>{details.licenseNumber}</Text>
          <Image source={{ uri: details.licenseImageUrl }} style={styles.preview} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Aadhaar</Text>
          <Text style={styles.kvTitle}>Number</Text>
          <Text style={styles.kvValue}>{details.aadhaarNumber}</Text>
          <Image source={{ uri: details.aadhaarImageUrl }} style={styles.preview} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PAN</Text>
          <Text style={styles.kvTitle}>Number</Text>
          <Text style={styles.kvValue}>{details.panNumber}</Text>
          <Image source={{ uri: details.panImageUrl }} style={styles.preview} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driver Experience</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.kvTitle}>Mark as Experienced Driver</Text>
            <Switch value={isExperienced} onValueChange={setIsExperienced} disabled={isSubmitting} />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.approveBtn, isSubmitting && styles.disabled]}
            activeOpacity={0.9}
            disabled={isSubmitting}
            onPress={() => void approve(true)}
          >
            {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.actionText}>Approve</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rejectBtn, isSubmitting && styles.disabled]}
            activeOpacity={0.9}
            disabled={isSubmitting}
            onPress={() => void approve(false)}
          >
            <Text style={styles.actionText}>Reject</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reasonWrap}>
          <Text style={styles.reasonLabel}>Rejection reason (optional)</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="e.g. Image blurred / Number mismatch"
            value={rejectReason}
            onChangeText={setRejectReason}
            editable={!isSubmitting}
            multiline
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
  },
  backBtn: { padding: 10 },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '900', color: G.textPrimary },
  content: { padding: 14, paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: '900', color: G.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: G.textPrimary, marginBottom: 10 },
  kvTitle: { color: G.textSecondary, fontWeight: '800' },
  kvValue: { marginTop: 4, color: G.textPrimary, fontWeight: '900' },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: G.glass2, marginTop: 12 },
  actions: { flexDirection: 'row', marginTop: 4 },
  reasonWrap: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 14,
    padding: 12,
  },
  reasonLabel: { color: G.textSecondary, fontWeight: '800', marginBottom: 8 },
  reasonInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: G.textPrimary,
    fontWeight: '700',
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 6,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginLeft: 6,
  },
  actionText: { color: G.textPrimary, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});

export default AdminDriverVerificationDetailScreen;
