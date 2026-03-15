import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Alert, RefreshControl, ActivityIndicator, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { generateReferralCode, getReferralStats } from '../../services/api';
import { useAppSelector } from '../../redux/store';
import { UserType } from '../../types';

const ReferralScreen = ({ navigation }: any) => {
  const userType = useAppSelector((s) => s.auth.user?.userType);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [referredReward, setReferredReward] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDriver = userType === UserType.DRIVER;
  const type = isDriver ? 'DRIVER' : 'CUSTOMER';

  const fetchData = useCallback(async () => {
    try {
      const [codeRes, statsRes] = await Promise.all([
        generateReferralCode(type),
        getReferralStats(),
      ]);
      setReferralCode(codeRes?.referralCode ?? null);
      setRewardAmount(codeRes?.rewardAmount ?? 0);
      setReferredReward(codeRes?.referredReward ?? 0);
      setStats(statsRes);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  }, [type]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const shareCode = async () => {
    if (!referralCode) return;
    try {
      const msg = isDriver
        ? `Join DriveMate as a driver! Use my referral code: ${referralCode} and earn ₹${referredReward} on your first ride. Download: https://play.google.com/store/apps/details?id=com.drivemateservice.driver`
        : `Get ₹${referredReward} off your first DriveMate ride! Use code: ${referralCode}. Download: https://play.google.com/store/apps/details?id=com.drivemateservice.app`;
      await Share.share({ message: msg });
    } catch { }
  };

  const copyCode = () => {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Icon name="gift" size={40} color="#ffffff" />
          </View>
          <Text style={styles.heroTitle}>
            Earn ₹{rewardAmount} per referral
          </Text>
          <Text style={styles.heroSubtitle}>
            Your friend gets ₹{referredReward} too!
          </Text>
        </View>

        {/* Referral Code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeValue}>{referralCode ?? '---'}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={copyCode}>
              <Icon name="content-copy" size={18} color="#C9A84C" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Share Button */}
        <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
          <Icon name="share-variant" size={20} color="#ffffff" />
          <Text style={styles.shareBtnText}>Share with friends</Text>
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.totalReferrals ?? 0}</Text>
            <Text style={styles.statLabel}>Invited</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.completedReferrals ?? 0}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#10b981' }]}>
              ₹{stats?.totalEarned ?? 0}
            </Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.stepsCard}>
          {[
            { icon: 'share-variant', text: 'Share your code with friends', color: '#7c3aed' },
            { icon: 'account-plus', text: 'They sign up using your code', color: '#C9A84C' },
            { icon: 'car', text: 'They complete their first ride', color: '#f59e0b' },
            { icon: 'wallet-plus', text: `You both get rewarded!`, color: '#10b981' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: `${step.color}15` }]}>
                <Icon name={step.icon as any} size={20} color={step.color} />
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
              {i < 3 && <View style={styles.stepConnector} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#141414',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#7c3aed', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
  },
  heroIconWrap: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff', textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '600' },
  codeCard: {
    backgroundColor: '#0A0A0A', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', borderStyle: 'dashed',
  },
  codeLabel: { fontSize: 12, color: '#8A8A8A', fontWeight: '600', marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeValue: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  copyBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#141414',
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#C9A84C', borderRadius: 14, paddingVertical: 14, gap: 8, marginBottom: 20,
  },
  shareBtnText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#0A0A0A', borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  statNumber: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#8A8A8A', fontWeight: '600', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
  stepsCard: {
    backgroundColor: '#0A0A0A', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, position: 'relative' },
  stepIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  stepText: { flex: 1, marginLeft: 14, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  stepConnector: {
    position: 'absolute', left: 21, top: 44, width: 2, height: 16,
    backgroundColor: '#1E1E1E',
  },
});

export default ReferralScreen;
