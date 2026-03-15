import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@dmate_streaks';

interface StreakData {
    currentStreak: number;
    weeklyRides: number;
    lastRideDate: string;
    rewards: StreakReward[];
}

interface StreakReward {
    target: number;
    label: string;
    discount: number;
    unlocked: boolean;
}

const DEFAULT_REWARDS: StreakReward[] = [
    { target: 3, label: '3 rides this week', discount: 5, unlocked: false },
    { target: 5, label: '5 rides this week', discount: 10, unlocked: false },
    { target: 8, label: '8 rides this week', discount: 15, unlocked: false },
    { target: 12, label: '12 rides this week', discount: 20, unlocked: false },
];

const StreakBonusScreen = ({ navigation }: any) => {
    const [streak, setStreak] = useState<StreakData>({
        currentStreak: 0,
        weeklyRides: 0,
        lastRideDate: '',
        rewards: DEFAULT_REWARDS,
    });

    useEffect(() => {
        void loadStreak();
    }, []);

    const loadStreak = async () => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                // Update rewards unlock status
                const rewards = DEFAULT_REWARDS.map((r) => ({
                    ...r,
                    unlocked: (data.weeklyRides || 0) >= r.target,
                }));
                setStreak({ ...data, rewards });
            }
        } catch { }
    };

    const nextReward = streak.rewards.find((r) => !r.unlocked);
    const ridesNeeded = nextReward ? nextReward.target - streak.weeklyRides : 0;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Streak Bonuses</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Streak card */}
                <View style={styles.streakCard}>
                    <View style={styles.streakIconWrap}>
                        <Icon name="fire" size={36} color="#f59e0b" />
                    </View>
                    <Text style={styles.streakCount}>{streak.weeklyRides}</Text>
                    <Text style={styles.streakLabel}>rides this week</Text>
                    {nextReward ? (
                        <View style={styles.nextRewardChip}>
                            <Icon name="gift" size={14} color="#6366f1" />
                            <Text style={styles.nextRewardText}>
                                {ridesNeeded} more ride{ridesNeeded !== 1 ? 's' : ''} for {nextReward.discount}% off!
                            </Text>
                        </View>
                    ) : (
                        <View style={[styles.nextRewardChip, { backgroundColor: '#141414' }]}>
                            <Icon name="check-circle" size={14} color="#16a34a" />
                            <Text style={[styles.nextRewardText, { color: '#16a34a' }]}>All bonuses unlocked! 🎉</Text>
                        </View>
                    )}
                </View>

                {/* Rewards tiers */}
                <Text style={styles.sectionTitle}>Weekly Rewards</Text>
                {streak.rewards.map((reward, i) => (
                    <View key={i} style={[styles.rewardRow, reward.unlocked && styles.rewardRowUnlocked]}>
                        <View style={[styles.rewardDot, reward.unlocked && styles.rewardDotUnlocked]}>
                            <Icon
                                name={reward.unlocked ? 'check' : 'lock'}
                                size={14}
                                color={reward.unlocked ? '#ffffff' : '#9ca3af'}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.rewardLabel, reward.unlocked && styles.rewardLabelUnlocked]}>
                                {reward.label}
                            </Text>
                            <Text style={styles.rewardDiscount}>{reward.discount}% discount on next ride</Text>
                        </View>
                        {reward.unlocked ? (
                            <View style={styles.unlockedBadge}>
                                <Text style={styles.unlockedBadgeText}>Unlocked</Text>
                            </View>
                        ) : (
                            <Text style={styles.targetText}>{reward.target - streak.weeklyRides} more</Text>
                        )}
                    </View>
                ))}

                {/* How it works */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>How Streaks Work</Text>
                    <View style={styles.infoRow}>
                        <Icon name="numeric-1-circle" size={20} color="#6366f1" />
                        <Text style={styles.infoText}>Complete rides to build your weekly streak</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Icon name="numeric-2-circle" size={20} color="#6366f1" />
                        <Text style={styles.infoText}>Unlock discount tiers as you reach milestones</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Icon name="numeric-3-circle" size={20} color="#6366f1" />
                        <Text style={styles.infoText}>Discounts auto-apply to your next booking</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Icon name="refresh" size={20} color="#9ca3af" />
                        <Text style={styles.infoText}>Streak resets every Monday at 12:00 AM</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

// Helper: call after ride completion to increment streak
export const incrementStreakRide = async () => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : { currentStreak: 0, weeklyRides: 0, lastRideDate: '' };
        const today = new Date().toISOString().split('T')[0];
        const lastDate = data.lastRideDate || '';

        // Check if we need to reset (Monday reset logic)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const lastRideDate = lastDate ? new Date(lastDate) : null;
        const lastDayOfWeek = lastRideDate ? lastRideDate.getDay() : -1;

        // Simple week reset: if last ride was before this week's Monday
        const mondayThisWeek = new Date(now);
        mondayThisWeek.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
        mondayThisWeek.setHours(0, 0, 0, 0);

        const shouldReset = !lastRideDate || lastRideDate < mondayThisWeek;

        const updated = {
            currentStreak: shouldReset ? 1 : data.currentStreak + 1,
            weeklyRides: shouldReset ? 1 : data.weeklyRides + 1,
            lastRideDate: today,
        };

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    } catch {
        return null;
    }
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111111' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0A0A0A',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)',
    },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
    content: { padding: 16, paddingBottom: 32 },

    streakCard: {
        backgroundColor: '#0A0A0A', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6,
    },
    streakIconWrap: {
        width: 60, height: 60, borderRadius: 30, backgroundColor: '#1A1708',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    streakCount: { fontSize: 40, fontWeight: '900', color: '#FFFFFF' },
    streakLabel: { fontSize: 14, fontWeight: '600', color: '#8A8A8A', marginBottom: 12 },
    nextRewardChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(139,92,246,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    },
    nextRewardText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

    sectionTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', marginBottom: 12 },

    rewardRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: '#0A0A0A', borderRadius: 12, padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    rewardRowUnlocked: { borderColor: '#bbf7d0', backgroundColor: '#141414' },
    rewardDot: {
        width: 30, height: 30, borderRadius: 15, backgroundColor: '#141414',
        alignItems: 'center', justifyContent: 'center',
    },
    rewardDotUnlocked: { backgroundColor: '#16a34a' },
    rewardLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    rewardLabelUnlocked: { color: '#065f46' },
    rewardDiscount: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },
    unlockedBadge: { backgroundColor: '#141414', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    unlockedBadgeText: { fontSize: 10, fontWeight: '800', color: '#16a34a' },
    targetText: { fontSize: 12, fontWeight: '700', color: '#666666' },

    infoCard: {
        backgroundColor: '#0A0A0A', borderRadius: 14, padding: 16, marginTop: 12,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    infoTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    infoText: { flex: 1, fontSize: 13, color: '#CCCCCC', fontWeight: '600' },
});

export default StreakBonusScreen;
