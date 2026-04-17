import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getDiscountPreview, type DiscountPreview } from '../../services/api';
import { G } from '../../constants/glassStyles';

const STREAK_TIERS = [
    { rides: 3, pct: 2, label: '3 rides in 7 days', color: '#3b82f6' },
    { rides: 5, pct: 5, label: '5 rides in 7 days', color: '#8b5cf6' },
    { rides: 8, pct: 7, label: '8 rides in 7 days', color: '#f59e0b' },
    { rides: 12, pct: 10, label: '12 rides in 7 days', color: '#ef4444' },
];

const StreakBonusScreen = ({ navigation }: any) => {
    const [preview, setPreview] = useState<DiscountPreview | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const fetch = async () => {
            try {
                const data = await getDiscountPreview(1000); // sample ₹1000 fare
                if (alive) setPreview(data);
            } catch { } finally {
                if (alive) setLoading(false);
            }
        };
        void fetch();
        return () => { alive = false; };
    }, []);

    const streakRides = preview?.streakRides ?? 0;
    const currentPct = preview?.streakPct ?? 0;
    const nextTier = preview?.nextStreakTier ?? null;
    const ridesNeeded = nextTier ? Math.max(0, nextTier.rides - streakRides) : 0;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Streak Bonuses</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.emptyWrap}>
                    <ActivityIndicator size="small" color="#C9A84C" />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Current streak */}
                    <View style={styles.streakCard}>
                        <View style={styles.streakIconWrap}>
                            <Icon name="fire" size={36} color="#f59e0b" />
                        </View>
                        <Text style={styles.streakCount}>{streakRides}</Text>
                        <Text style={styles.streakLabel}>rides in last 7 days</Text>
                        {currentPct > 0 ? (
                            <View style={[styles.activeChip, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                                <Icon name="check-circle" size={14} color="#10b981" />
                                <Text style={[styles.activeChipText, { color: '#10b981' }]}>
                                    {currentPct}% discount active on all rides!
                                </Text>
                            </View>
                        ) : null}
                        {nextTier && ridesNeeded > 0 ? (
                            <View style={styles.nextRewardChip}>
                                <Icon name="gift" size={14} color="#C9A84C" />
                                <Text style={styles.nextRewardText}>
                                    {ridesNeeded} more ride{ridesNeeded !== 1 ? 's' : ''} for {nextTier.pct}% off!
                                </Text>
                            </View>
                        ) : currentPct >= 10 ? (
                            <View style={[styles.nextRewardChip, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Icon name="trophy" size={14} color="#10b981" />
                                <Text style={[styles.nextRewardText, { color: '#10b981' }]}>Max streak unlocked! 🏆</Text>
                            </View>
                        ) : null}
                    </View>

                    {/* Tiers */}
                    <Text style={styles.sectionTitle}>Discount Tiers</Text>
                    {STREAK_TIERS.map((tier, i) => {
                        const unlocked = streakRides >= tier.rides;
                        const isCurrent = currentPct === tier.pct && currentPct > 0;
                        return (
                            <View key={i} style={[styles.rewardRow, unlocked && styles.rewardRowUnlocked, isCurrent && { borderColor: tier.color }]}>
                                <View style={[styles.rewardDot, unlocked ? { backgroundColor: tier.color } : null]}>
                                    <Icon
                                        name={unlocked ? 'check' : 'lock'}
                                        size={14}
                                        color={unlocked ? '#ffffff' : '#666666'}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.rewardLabel, unlocked && { color: G.textPrimary }]}>{tier.label}</Text>
                                    <Text style={styles.rewardDiscount}>{tier.pct}% discount on every ride</Text>
                                </View>
                                {unlocked ? (
                                    <View style={[styles.unlockedBadge, { backgroundColor: `${tier.color}20` }]}>
                                        <Text style={[styles.unlockedBadgeText, { color: tier.color }]}>
                                            {isCurrent ? 'Active' : 'Unlocked'}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={styles.targetText}>{tier.rides - streakRides} more</Text>
                                )}
                            </View>
                        );
                    })}

                    {/* How it works */}
                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>How Streaks Work</Text>
                        <View style={styles.infoRow}>
                            <Icon name="numeric-1-circle" size={20} color="#C9A84C" />
                            <Text style={styles.infoText}>Complete rides to build your 7-day streak</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Icon name="numeric-2-circle" size={20} color="#C9A84C" />
                            <Text style={styles.infoText}>Reach milestones to unlock higher discount tiers</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Icon name="numeric-3-circle" size={20} color="#C9A84C" />
                            <Text style={styles.infoText}>Discounts auto-apply on your next booking — shown in fare breakdown</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Icon name="calendar-clock" size={20} color="#8A8A8A" />
                            <Text style={styles.infoText}>Streak counts rides completed in the last 7 days (rolling window)</Text>
                        </View>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: G.bgAlt },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: G.bg,
        borderBottomWidth: 1, borderBottomColor: G.border3,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: G.glass2,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border3,
    },
    headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
    content: { padding: 16, paddingBottom: 32 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    streakCard: {
        backgroundColor: G.bg, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20,
        borderWidth: 1, borderColor: G.border3,
    },
    streakIconWrap: {
        width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(245,158,11,0.1)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    streakCount: { fontSize: 44, fontWeight: '900', color: G.textPrimary },
    streakLabel: { fontSize: 14, fontWeight: '600', color: G.textSecondary, marginBottom: 12 },
    activeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 8,
    },
    activeChipText: { fontSize: 13, fontWeight: '700' },
    nextRewardChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(201,168,76,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    },
    nextRewardText: { fontSize: 13, fontWeight: '700', color: G.accent },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: G.textPrimary, marginBottom: 12 },
    rewardRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: G.bg, borderRadius: 12, padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: G.border3,
    },
    rewardRowUnlocked: { borderColor: 'rgba(16,185,129,0.4)' },
    rewardDot: {
        width: 30, height: 30, borderRadius: 15, backgroundColor: G.glass3,
        alignItems: 'center', justifyContent: 'center',
    },
    rewardLabel: { fontSize: 13, fontWeight: '700', color: '#CCCCCC' },
    rewardDiscount: { fontSize: 11, color: G.textSecondary, marginTop: 2 },
    unlockedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    unlockedBadgeText: { fontSize: 10, fontWeight: '800' },
    targetText: { fontSize: 12, fontWeight: '700', color: G.textMuted },
    infoCard: {
        backgroundColor: G.bg, borderRadius: 14, padding: 16, marginTop: 12,
        borderWidth: 1, borderColor: G.border3,
    },
    infoTitle: { fontSize: 14, fontWeight: '800', color: G.textPrimary, marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    infoText: { flex: 1, fontSize: 13, color: '#CCCCCC', fontWeight: '600' },
});

export default StreakBonusScreen;
