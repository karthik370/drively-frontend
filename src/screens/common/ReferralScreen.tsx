import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Alert, RefreshControl, ActivityIndicator, TextInput, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { generateReferralCode, getReferralStats, applyReferralCode } from '../../services/api';
import { useAppSelector } from '../../redux/store';
import { UserType } from '../../types';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';


const ReferralScreen = ({ navigation }: any) => {
  const userType = useAppSelector((s) => s.auth.user?.userType);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [referredReward, setReferredReward] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Apply code state
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);

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
        ? `Join Drively as a driver! Use my referral code: ${referralCode} and earn ₹${referredReward} on your first ride. Download: https://play.google.com/store/apps/details?id=com.drively.driver`
        : `Get ₹${referredReward} off your first Drively ride! Use code: ${referralCode}. Download: https://play.google.com/store/apps/details?id=com.drively.app`;
      await Share.share({ message: msg });
    } catch { }
  };

  const copyCode = async () => {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    showAlert('Copied!', 'Referral code copied to clipboard');
  };

  const handleApplyCode = async () => {
    const code = applyCode.trim();
    if (!code) {
      showAlert('Enter Code', 'Please enter a referral code');
      return;
    }
    setApplying(true);
    try {
      const result = await applyReferralCode(code);
      showAlert(
        '🎉 Code Applied!',
        `Referred by ${result?.referrerName || 'a friend'}. Complete your first ride to earn ₹${result?.rewardOnFirstTrip || 0}!`,
      );
      setApplyCode('');
      fetchData(); // Refresh stats
    } catch (e: any) {
      showAlert('Error', e?.message || 'Invalid referral code');
    }
    setApplying(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const hasAppliedCode = !!stats?.myReferral;

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

        {/* Apply Referral Code — only if user hasn't already applied one */}
        {!hasAppliedCode && (
          <View style={styles.applyCard}>
            <Text style={styles.applyTitle}>Have a referral code?</Text>
            <Text style={styles.applyDesc}>
              Enter your friend's code to earn ₹{referredReward} after your first ride
            </Text>
            <View style={styles.applyRow}>
              <TextInput
                style={styles.applyInput}
                placeholder="Enter code"
                placeholderTextColor="#666"
                value={applyCode}
                onChangeText={setApplyCode}
                autoCapitalize="characters"
                maxLength={15}
                editable={!applying}
              />
              <TouchableOpacity
                style={[styles.applyBtn, applying && { opacity: 0.6 }]}
                onPress={handleApplyCode}
                disabled={applying}
              >
                {applying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.applyBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Referred by indicator */}
        {hasAppliedCode && (
          <View style={styles.referredCard}>
            <Icon name="check-circle" size={20} color="#10b981" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.referredTitle}>
                Referred by {stats.myReferral.referrerName}
              </Text>
              <Text style={styles.referredStatus}>
                {stats.myReferral.status === 'REWARDED'
                  ? `✅ ₹${stats.myReferral.reward} credited to your wallet`
                  : `⏳ Complete your first ride to earn ₹${stats.myReferral.reward}`}
              </Text>
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.totalReferrals ?? 0}</Text>
            <Text style={styles.statLabel}>Invited</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.rewardedReferrals ?? 0}</Text>
            <Text style={styles.statLabel}>Rewarded</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#10b981' }]}>
              ₹{stats?.totalEarned ?? 0}
            </Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>

        {/* Recent Referrals */}
        {stats?.recentReferrals?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your Referrals</Text>
            {stats.recentReferrals.map((r: any) => (
              <View key={r.id} style={styles.refRow}>
                <View style={[styles.refIcon, r.status === 'REWARDED' ? styles.refIconRewarded : styles.refIconPending]}>
                  <Icon
                    name={r.status === 'REWARDED' ? 'check' : 'clock-outline'}
                    size={16}
                    color={r.status === 'REWARDED' ? '#10b981' : '#f59e0b'}
                  />
                </View>
                <View style={styles.refInfo}>
                  <Text style={styles.refName}>{r.name}</Text>
                  <Text style={styles.refStatus}>
                    {r.status === 'REWARDED' ? `Earned ₹${r.reward}` : 'Waiting for first ride'}
                  </Text>
                </View>
                <Text style={[
                  styles.refReward,
                  { color: r.status === 'REWARDED' ? '#10b981' : '#666' }
                ]}>
                  {r.status === 'REWARDED' ? `+₹${r.reward}` : `₹${r.reward}`}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* How it works */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>How it works</Text>
        <View style={styles.stepsCard}>
          {[
            { icon: 'share-variant', text: 'Share your code with friends', color: '#7c3aed' },
            { icon: 'account-plus', text: 'They sign up & enter your code', color: G.accent },
            { icon: 'car', text: 'They complete their first ride', color: '#f59e0b' },
            { icon: 'wallet-plus', text: `You both get ₹ credited to wallet!`, color: '#10b981' },
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
  container: { flex: 1, backgroundColor: G.bgAlt },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: G.bg, borderBottomWidth: 1, borderBottomColor: G.border3,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: G.glass2,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: G.textPrimary },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#7c3aed', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
  },
  heroIconWrap: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: G.textPrimary, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '600' },
  codeCard: {
    backgroundColor: G.bg, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: G.border3, borderStyle: 'dashed',
  },
  codeLabel: { fontSize: 12, color: G.textSecondary, fontWeight: '600', marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeValue: { fontSize: 28, fontWeight: '900', color: G.textPrimary, letterSpacing: 2 },
  copyBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: G.glass2,
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: G.accent, borderRadius: 14, paddingVertical: 14, gap: 8, marginBottom: 16,
  },
  shareBtnText: { fontSize: 16, fontWeight: '800', color: G.textPrimary },

  // Apply code section
  applyCard: {
    backgroundColor: G.bg, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
  },
  applyTitle: { fontSize: 15, fontWeight: '800', color: G.textPrimary, marginBottom: 4 },
  applyDesc: { fontSize: 12, color: G.textSecondary, marginBottom: 12 },
  applyRow: { flexDirection: 'row', gap: 10 },
  applyInput: {
    flex: 1, backgroundColor: G.glass3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontWeight: '700', color: G.textPrimary, letterSpacing: 1.5,
    borderWidth: 1, borderColor: G.border1,
  },
  applyBtn: {
    backgroundColor: G.accent, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center',
  },
  applyBtnText: { fontSize: 14, fontWeight: '800', color: G.textPrimary },

  // Referred by card
  referredCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  referredTitle: { fontSize: 13, fontWeight: '700', color: '#10b981' },
  referredStatus: { fontSize: 12, color: G.textSecondary, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: G.bg, borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: G.border3,
  },
  statNumber: { fontSize: 24, fontWeight: '900', color: G.textPrimary },
  statLabel: { fontSize: 12, color: G.textSecondary, fontWeight: '600', marginTop: 4 },

  // Recent referrals
  sectionTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary, marginBottom: 12 },
  refRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: G.bg,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: G.border3,
  },
  refIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  refIconRewarded: { backgroundColor: 'rgba(16,185,129,0.1)' },
  refIconPending: { backgroundColor: 'rgba(245,158,11,0.1)' },
  refInfo: { flex: 1, marginLeft: 12 },
  refName: { fontSize: 13, fontWeight: '600', color: G.textPrimary },
  refStatus: { fontSize: 11, color: G.textMuted, marginTop: 2 },
  refReward: { fontSize: 15, fontWeight: '800' },

  // How it works
  stepsCard: {
    backgroundColor: G.bg, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: G.border3,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, position: 'relative' },
  stepIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  stepText: { flex: 1, marginLeft: 14, fontSize: 14, fontWeight: '600', color: G.textPrimary },
  stepConnector: {
    position: 'absolute', left: 21, top: 44, width: 2, height: 16,
    backgroundColor: G.glass3,
  },
});

export default ReferralScreen;
