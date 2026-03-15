import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, Share, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getRewardsSummary, getRewardsHistory } from '../../services/api';

const RewardsScreen = ({ navigation }: any) => {
    const [summary, setSummary] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [summaryRes, historyRes] = await Promise.all([
                getRewardsSummary(),
                getRewardsHistory(30),
            ]);
            setSummary(summaryRes);
            setHistory(Array.isArray(historyRes) ? historyRes : []);
        } catch { }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 80 }} />
            </SafeAreaView>
        );
    }

    const balance = summary?.balance ?? 0;
    const discountValue = summary?.discountValue ?? 0;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Rewards</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Balance Card */}
                <View style={styles.balanceCard}>
                    <View style={styles.balanceTop}>
                        <View style={styles.coinIconWrap}>
                            <Icon name="star-circle" size={36} color="#f59e0b" />
                        </View>
                        <View style={{ marginLeft: 14 }}>
                            <Text style={styles.balanceLabel}>Coin Balance</Text>
                            <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
                        </View>
                    </View>
                    <View style={styles.balanceDivider} />
                    <View style={styles.balanceBottom}>
                        <View style={styles.balanceStat}>
                            <Text style={styles.statLabel}>Earned</Text>
                            <Text style={styles.statValue}>{(summary?.totalEarned ?? 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.balanceStatDivider} />
                        <View style={styles.balanceStat}>
                            <Text style={styles.statLabel}>Spent</Text>
                            <Text style={styles.statValue}>{(summary?.totalSpent ?? 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.balanceStatDivider} />
                        <View style={styles.balanceStat}>
                            <Text style={styles.statLabel}>Discount</Text>
                            <Text style={[styles.statValue, { color: '#10b981' }]}>₹{discountValue}</Text>
                        </View>
                    </View>
                </View>

                {/* How it works */}
                <View style={styles.howItWorks}>
                    <Text style={styles.sectionTitle}>How Coins Work</Text>
                    <View style={styles.howRow}>
                        <View style={[styles.howIcon, { backgroundColor: '#141414' }]}>
                            <Icon name="car" size={18} color="#C9A84C" />
                        </View>
                        <View style={styles.howInfo}>
                            <Text style={styles.howTitle}>Earn per ride</Text>
                            <Text style={styles.howDesc}>10 coins + 5 coins per ₹100 fare</Text>
                        </View>
                    </View>
                    <View style={styles.howRow}>
                        <View style={[styles.howIcon, { backgroundColor: '#141414' }]}>
                            <Icon name="tag" size={18} color="#16a34a" />
                        </View>
                        <View style={styles.howInfo}>
                            <Text style={styles.howTitle}>Redeem for discounts</Text>
                            <Text style={styles.howDesc}>10 coins = ₹1 off your ride</Text>
                        </View>
                    </View>
                    <View style={styles.howRow}>
                        <View style={[styles.howIcon, { backgroundColor: 'rgba(236,72,153,0.1)' }]}>
                            <Icon name="account-plus" size={18} color="#db2777" />
                        </View>
                        <View style={styles.howInfo}>
                            <Text style={styles.howTitle}>Bonus coins</Text>
                            <Text style={styles.howDesc}>Earn extra from referrals and streaks</Text>
                        </View>
                    </View>
                </View>

                {/* Transaction History */}
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                {history.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Icon name="star-off" size={32} color="#d1d5db" />
                        <Text style={styles.emptyText}>No coin activity yet</Text>
                        <Text style={styles.emptyHint}>Complete a ride to start earning!</Text>
                    </View>
                ) : (
                    history.map((tx, index) => (
                        <View key={tx.id || index} style={styles.txRow}>
                            <View style={[styles.txIcon, tx.amount > 0 ? styles.txIconEarned : styles.txIconSpent]}>
                                <Icon
                                    name={tx.amount > 0 ? 'arrow-down' : 'arrow-up'}
                                    size={16}
                                    color={tx.amount > 0 ? '#10b981' : '#ef4444'}
                                />
                            </View>
                            <View style={styles.txInfo}>
                                <Text style={styles.txReason} numberOfLines={1}>{tx.reason}</Text>
                                <Text style={styles.txDate}>
                                    {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                    })}
                                </Text>
                            </View>
                            <Text style={[styles.txAmount, tx.amount > 0 ? styles.txAmountPlus : styles.txAmountMinus]}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount}
                            </Text>
                        </View>
                    ))
                )}
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
    balanceCard: {
        backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 20,
    },
    balanceTop: { flexDirection: 'row', alignItems: 'center' },
    coinIconWrap: {
        width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(245,158,11,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
    balanceValue: { fontSize: 32, fontWeight: '900', color: '#ffffff', marginTop: 2 },
    balanceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
    balanceBottom: { flexDirection: 'row', justifyContent: 'space-between' },
    balanceStat: { flex: 1, alignItems: 'center' },
    balanceStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
    statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
    statValue: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginTop: 4 },
    howItWorks: {
        backgroundColor: '#0A0A0A', borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 20,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
    howRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    howIcon: {
        width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    },
    howInfo: { flex: 1, marginLeft: 12 },
    howTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    howDesc: { fontSize: 12, color: '#8A8A8A', marginTop: 1 },
    emptyCard: {
        backgroundColor: '#0A0A0A', borderRadius: 16, padding: 32,
        alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    emptyText: { fontSize: 15, fontWeight: '700', color: '#CCCCCC', marginTop: 12 },
    emptyHint: { fontSize: 13, color: '#666666', marginTop: 4 },
    txRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A',
        borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    txIcon: {
        width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    },
    txIconEarned: { backgroundColor: '#141414' },
    txIconSpent: { backgroundColor: '#1A1010' },
    txInfo: { flex: 1, marginLeft: 12 },
    txReason: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
    txDate: { fontSize: 11, color: '#666666', marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '800' },
    txAmountPlus: { color: '#10b981' },
    txAmountMinus: { color: '#ef4444' },
});

export default RewardsScreen;
