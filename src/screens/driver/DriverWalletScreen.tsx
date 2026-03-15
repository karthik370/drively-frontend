import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {
    getDriverWalletSummary,
    getDriverWalletTransactions,
    requestDriverPayout,
} from '../../services/api';

const DriverWalletScreen = ({ navigation }: any) => {
    const [summary, setSummary] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutMethod] = useState<'BANK'>('BANK');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [summaryRes, txRes] = await Promise.all([
                getDriverWalletSummary(),
                getDriverWalletTransactions(30),
            ]);
            setSummary(summaryRes);
            setTransactions(Array.isArray(txRes) ? txRes : []);
        } catch { }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const handlePayout = async () => {
        const amt = parseFloat(payoutAmount);
        if (!amt || amt < 100) {
            Alert.alert('Invalid amount', 'Minimum withdrawal is ₹100');
            return;
        }
        if (amt > (summary?.withdrawableBalance ?? 0)) {
            Alert.alert('Insufficient balance', `Available: ₹${(summary?.withdrawableBalance ?? 0).toFixed(0)}`);
            return;
        }
        setIsSubmitting(true);
        try {
            await requestDriverPayout(amt, payoutMethod);
            Alert.alert('Payout Requested', `₹${amt.toFixed(0)} withdrawal requested via Bank Transfer. It will be processed within 24 hours.`);
            setShowPayoutModal(false);
            setPayoutAmount('');
            fetchData();
        } catch (e: any) {
            Alert.alert('Payout Failed', e?.message || 'Could not process payout');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    const available = summary?.availableBalance ?? 0;
    const withdrawable = summary?.withdrawableBalance ?? 0;
    const totalEarned = summary?.totalEarnings ?? 0;
    const totalPaid = summary?.totalPaidOut ?? 0;
    const pendingPayouts = summary?.pendingPayoutsAmount ?? 0;

    const txIcon = (type: string) => {
        switch (type) {
            case 'RIDE_EARNING': return { name: 'car', bg: '#dcfce7', color: '#16a34a' };
            case 'TIP': return { name: 'heart', bg: '#fce7f3', color: '#db2777' };
            case 'PAYOUT': return { name: 'bank-transfer', bg: '#dbeafe', color: '#C9A84C' };
            default: return { name: 'cash', bg: '#f3f4f6', color: '#8A8A8A' };
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Wallet</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Balance Card (emerald gradient feel) */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                    <Text style={styles.balanceValue}>₹{available.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>

                    <View style={styles.balanceDivider} />

                    <View style={styles.balanceStatsRow}>
                        <View style={styles.balanceStat}>
                            <Text style={styles.statLabel}>Total Earned</Text>
                            <Text style={styles.statValue}>₹{totalEarned.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <View style={styles.balanceStatSep} />
                        <View style={styles.balanceStat}>
                            <Text style={styles.statLabel}>Withdrawn</Text>
                            <Text style={styles.statValue}>₹{totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <View style={styles.balanceStatSep} />
                        <View style={styles.balanceStat}>
                            <Text style={styles.statLabel}>Pending</Text>
                            <Text style={[styles.statValue, { color: '#fbbf24' }]}>₹{pendingPayouts.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                    </View>
                </View>

                {/* Withdraw Button */}
                <TouchableOpacity
                    style={[styles.withdrawBtn, withdrawable < 100 && styles.withdrawBtnDisabled]}
                    onPress={() => {
                        if (withdrawable < 100) {
                            Alert.alert('Minimum ₹100', 'You need at least ₹100 to withdraw');
                            return;
                        }
                        setPayoutAmount(String(Math.floor(withdrawable)));
                        setShowPayoutModal(true);
                    }}
                >
                    <Icon name="bank-transfer-out" size={20} color="#ffffff" />
                    <Text style={styles.withdrawBtnText}>
                        Withdraw ₹{withdrawable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                </TouchableOpacity>

                {/* Payout Methods */}
                <View style={styles.methodsCard}>
                    <Text style={styles.sectionTitle}>Payout Methods</Text>
                    {summary?.payoutMethods?.bank ? (
                        <View style={styles.methodRow}>
                            <View style={[styles.methodIcon, { backgroundColor: '#141414' }]}>
                                <Icon name="bank" size={18} color="#C9A84C" />
                            </View>
                            <View style={styles.methodInfo}>
                                <Text style={styles.methodTitle}>Bank Account</Text>
                                <Text style={styles.methodSub}>
                                    {summary.payoutMethods.bank.holderName} • {summary.payoutMethods.bank.accountNumber}
                                </Text>
                            </View>
                            <Icon name="check-circle" size={18} color="#10b981" />
                        </View>
                    ) : (
                        <View style={styles.methodRow}>
                            <View style={[styles.methodIcon, { backgroundColor: '#141414' }]}>
                                <Icon name="bank" size={18} color="#9ca3af" />
                            </View>
                            <Text style={styles.methodTitle}>No bank account linked</Text>
                        </View>
                    )}
                </View>

                {/* Transaction History */}
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                {transactions.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Icon name="wallet-outline" size={36} color="#d1d5db" />
                        <Text style={styles.emptyText}>No transactions yet</Text>
                        <Text style={styles.emptyHint}>Complete rides to start earning</Text>
                    </View>
                ) : (
                    transactions.map((tx, index) => {
                        const ic = txIcon(tx.type);
                        return (
                            <View key={tx.id || index} style={styles.txRow}>
                                <View style={[styles.txIcon, { backgroundColor: ic.bg }]}>
                                    <Icon name={ic.name as any} size={16} color={ic.color} />
                                </View>
                                <View style={styles.txInfo}>
                                    <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                                    {tx.subtext && <Text style={styles.txSub} numberOfLines={1}>{tx.subtext}</Text>}
                                    <Text style={styles.txDate}>
                                        {new Date(tx.date).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                        })}
                                    </Text>
                                </View>
                                <Text style={[styles.txAmount, tx.amount >= 0 ? styles.txPlus : styles.txMinus]}>
                                    {tx.amount >= 0 ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </Text>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Payout Modal */}
            <Modal visible={showPayoutModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Withdraw Earnings</Text>
                        <Text style={styles.modalHint}>
                            Available: ₹{withdrawable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            keyboardType="numeric"
                            placeholder="Enter amount (min ₹100)"
                            value={payoutAmount}
                            onChangeText={setPayoutAmount}
                            editable={!isSubmitting}
                        />



                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => { if (!isSubmitting) setShowPayoutModal(false); }}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, isSubmitting && { opacity: 0.6 }]}
                                onPress={handlePayout}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.modalConfirmText}>
                                    {isSubmitting ? 'Processing...' : 'Withdraw'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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

    // Balance Card
    balanceCard: {
        backgroundColor: '#065f46', borderRadius: 20, padding: 24, marginBottom: 16,
    },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
    balanceValue: { fontSize: 36, fontWeight: '900', color: '#ffffff', marginTop: 4 },
    balanceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 16 },
    balanceStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    balanceStat: { flex: 1, alignItems: 'center' },
    balanceStatSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
    statValue: { fontSize: 15, fontWeight: '800', color: '#ffffff', marginTop: 4 },

    // Withdraw button
    withdrawBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#10b981', borderRadius: 14, paddingVertical: 14, gap: 8,
        marginBottom: 16,
    },
    withdrawBtnDisabled: { backgroundColor: '#666666' },
    withdrawBtnText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },

    // Payout Methods
    methodsCard: {
        backgroundColor: '#0A0A0A', borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 20,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
    methodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    methodIcon: {
        width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    },
    methodInfo: { flex: 1, marginLeft: 12 },
    methodTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginLeft: 12 },
    methodSub: { fontSize: 12, color: '#8A8A8A', marginTop: 1 },

    // Empty & Transactions
    emptyCard: {
        backgroundColor: '#0A0A0A', borderRadius: 16, padding: 32, alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
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
    txInfo: { flex: 1, marginLeft: 12 },
    txDesc: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
    txSub: { fontSize: 11, color: '#666666', marginTop: 1 },
    txDate: { fontSize: 11, color: '#666666', marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '800' },
    txPlus: { color: '#10b981' },
    txMinus: { color: '#C9A84C' },

    // Payout Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#0A0A0A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
    modalHint: { fontSize: 13, color: '#8A8A8A', marginBottom: 16 },
    modalInput: {
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12,
        paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700',
        color: '#FFFFFF', marginBottom: 16,
    },
    methodLabel: { fontSize: 13, fontWeight: '700', color: '#CCCCCC', marginBottom: 8 },
    methodToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    methodToggle: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 12, borderRadius: 12,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: '#111111',
    },
    methodToggleActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    methodToggleText: { fontSize: 14, fontWeight: '700', color: '#CCCCCC' },
    methodToggleTextActive: { color: '#ffffff' },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalCancelBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 12,
        backgroundColor: '#141414', alignItems: 'center',
    },
    modalCancelText: { fontSize: 15, fontWeight: '800', color: '#CCCCCC' },
    modalConfirmBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 12,
        backgroundColor: '#10b981', alignItems: 'center',
    },
    modalConfirmText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
});

export default DriverWalletScreen;
