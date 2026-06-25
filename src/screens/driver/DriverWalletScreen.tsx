import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {
    getDriverWalletSummary,
    getDriverWalletTransactions,
    requestDriverPayout,
    saveDriverUpiId,
    createDriverWalletTopupOrder,
    verifyDriverWalletTopup,
} from '../../services/api';
import { openCashfreeCheckout } from '../../services/cashfreeService';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const DriverWalletScreen = ({ navigation }: any) => {
    const [summary, setSummary] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Payout modal
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK'>('UPI');
    const [upiId, setUpiId] = useState('');
    const [bankAcc, setBankAcc] = useState('');
    const [bankIfsc, setBankIfsc] = useState('');
    const [bankName, setBankName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditingPayoutMethod, setIsEditingPayoutMethod] = useState(false);

    // UPI save modal
    const [showUpiModal, setShowUpiModal] = useState(false);
    const [upiInput, setUpiInput] = useState('');
    const [savingUpi, setSavingUpi] = useState(false);

    // Top-up modal
    const [showTopupModal, setShowTopupModal] = useState(false);
    const [topupAmount, setTopupAmount] = useState('100');
    const [isTopping, setIsTopping] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [summaryRes, txRes] = await Promise.all([
                getDriverWalletSummary(),
                getDriverWalletTransactions(50),
            ]);
            setSummary(summaryRes);
            setTransactions(Array.isArray(txRes) ? txRes : []);
        } catch { }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    const onRefresh = () => { setRefreshing(true); fetchData(); };

    // ── Top-up via Cashfree ──────────────────────────────────────────────────
    const handleTopup = async () => {
        if (isTopping) return;
        const amt = parseFloat(topupAmount);
        if (!amt || amt < 50) { showAlert('Minimum ₹50', 'Enter at least ₹50 to top up'); return; }
        setIsTopping(true);
        try {
            const order = await createDriverWalletTopupOrder(amt, 'UPI');
            const success = await openCashfreeCheckout({
                orderId: String(order.orderId),
                paymentSessionId: String(order.paymentSessionId),
            });
            await verifyDriverWalletTopup({ cf_order_id: success.orderId });
            showAlert('✅ Top-up Successful', `₹${amt.toFixed(0)} added to your wallet!`);
            setShowTopupModal(false);
            setTopupAmount('100');
            fetchData();
        } catch (e: any) {
            showAlert('Top-up Failed', e?.message || 'Payment failed. Please try again.');
        } finally {
            setIsTopping(false);
        }
    };

    // ── Payout ───────────────────────────────────────────────────────────────
    const handlePayout = async () => {
        const amt = parseFloat(payoutAmount);
        if (!amt || amt < 100) {
            showAlert('Invalid amount', 'Minimum withdrawal is ₹100');
            return;
        }
        if (amt > (summary?.withdrawableBalance ?? 0)) {
            showAlert('Insufficient balance', `Available: ₹${(summary?.withdrawableBalance ?? 0).toFixed(0)}`);
            return;
        }
        let details: any = {};
        if (payoutMethod === 'UPI') {
            const effectiveUpi = upiId.trim() || summary?.payoutMethods?.upiId;
            if (!effectiveUpi) { showAlert('UPI ID Required', 'Please enter your UPI ID'); return; }
            if (!effectiveUpi.includes('@')) {
                showAlert('Invalid UPI ID', 'UPI ID must be in format like yourname@upi or 9999999999@ybl.');
                return;
            }
            if (upiId.trim()) details.upiId = upiId.trim();
        } else {
            const hasBank = summary?.payoutMethods?.bank;
            if (!hasBank || isEditingPayoutMethod) {
                if (!bankAcc.trim() || !bankIfsc.trim() || !bankName.trim()) {
                    showAlert('Bank Details Required', 'Please fill all bank details');
                    return;
                }
                details.bankAccountNumber = bankAcc.trim();
                details.bankIfscCode = bankIfsc.trim();
                details.bankAccountHolderName = bankName.trim();
            }
        }
        setIsSubmitting(true);
        try {
            await requestDriverPayout(amt, payoutMethod, Object.keys(details).length > 0 ? details : undefined);
            showAlert('Withdrawal Initiated', `₹${amt.toFixed(0)} withdrawal via ${payoutMethod} has been submitted.`);
            setShowPayoutModal(false);
            setIsEditingPayoutMethod(false);
            setPayoutAmount('');
            setUpiId('');
            setBankAcc('');
            setBankIfsc('');
            setBankName('');
            fetchData();
        } catch (e: any) {
            showAlert('Payout Failed', e?.message || 'Could not process payout');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    const available = summary?.availableBalance ?? 0;
    const withdrawable = summary?.withdrawableBalance ?? 0;
    const totalEarned = summary?.totalEarnings ?? 0;
    const totalPaid = summary?.totalPaidOut ?? 0;
    const pendingPayouts = summary?.pendingPayoutsAmount ?? 0;
    const isBlocked = summary?.isBlocked ?? false;
    const amountToSettle = summary?.amountToSettle ?? 0;

    const txIcon = (type: string) => {
        switch (type) {
            case 'RIDE_EARNING': return { name: 'car', bg: '#dcfce7', color: '#16a34a' };
            case 'TIP': return { name: 'heart', bg: '#fce7f3', color: '#db2777' };
            case 'PAYOUT': return { name: 'bank-transfer', bg: '#dbeafe', color: G.accent };
            case 'PLATFORM_FEE': return { name: 'tag-minus', bg: '#fef3c7', color: '#d97706' };
            case 'WALLET_TOPUP': return { name: 'wallet-plus', bg: '#d1fae5', color: '#059669' };
            default: return { name: 'cash', bg: '#f3f4f6', color: G.textSecondary };
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Wallet</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('PayoutSettings')}>
                    <Icon name="cog" size={22} color="#C9A84C" />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* ── Blocked Warning Banner ── */}
                {isBlocked && (
                    <View style={styles.blockedBanner}>
                        <Icon name="alert-circle" size={22} color="#ffffff" />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.blockedTitle}>⚠️ Wallet Blocked — Cannot Accept Bookings</Text>
                            <Text style={styles.blockedBody}>
                                Balance is −₹{Math.abs(available).toFixed(0)} in deficit. Add at least ₹{amountToSettle} to resume accepting rides.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Balance Card */}
                <View style={[styles.balanceCard, isBlocked && styles.balanceCardBlocked]}>
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                    <Text style={[styles.balanceValue, available < 0 && { color: '#fca5a5' }]}>
                        {available < 0 ? '−' : ''}₹{Math.abs(available).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        {available < 0 ? ' (deficit)' : ''}
                    </Text>

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

                {/* Add Money + Withdraw row */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.topupBtn}
                        onPress={() => { setTopupAmount('100'); setShowTopupModal(true); }}
                    >
                        <Icon name="wallet-plus" size={18} color="#ffffff" />
                        <Text style={styles.actionBtnText}>Add Money</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.withdrawBtn, withdrawable < 100 && styles.withdrawBtnDisabled]}
                        onPress={() => {
                            if (withdrawable < 100) {
                                showAlert('Minimum ₹100', 'You need at least ₹100 to withdraw');
                                return;
                            }
                            setPayoutAmount(String(Math.floor(withdrawable)));
                            setShowPayoutModal(true);
                        }}
                    >
                        <Icon name="bank-transfer-out" size={18} color="#ffffff" />
                        <Text style={styles.actionBtnText}>
                            Withdraw ₹{withdrawable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Payout Methods */}
                <View style={styles.methodsCard}>
                    <Text style={styles.sectionTitle}>Payout Methods</Text>

                    {summary?.payoutMethods?.upiId && (
                        <View style={styles.methodRow}>
                            <View style={[styles.methodIcon, { backgroundColor: G.glass2 }]}>
                                <Icon name="cellphone" size={18} color="#C9A84C" />
                            </View>
                            <View style={styles.methodInfo}>
                                <Text style={styles.methodTitle}>UPI ID</Text>
                                <Text style={styles.methodSub}>{summary.payoutMethods.upiId}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    setPayoutMethod('UPI');
                                    setUpiId(summary.payoutMethods.upiId);
                                    setIsEditingPayoutMethod(true);
                                    setPayoutAmount(String(Math.floor(summary?.withdrawableBalance ?? 0)));
                                    setShowPayoutModal(true);
                                }}
                                style={styles.editBtn}
                            >
                                <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {summary?.payoutMethods?.bank && (
                        <View style={[styles.methodRow, { marginTop: summary?.payoutMethods?.upiId ? 8 : 0 }]}>
                            <View style={[styles.methodIcon, { backgroundColor: G.glass2 }]}>
                                <Icon name="bank" size={18} color="#C9A84C" />
                            </View>
                            <View style={styles.methodInfo}>
                                <Text style={styles.methodTitle}>Bank Account</Text>
                                <Text style={styles.methodSub}>
                                    {summary.payoutMethods.bank.holderName} • {summary.payoutMethods.bank.accountNumber}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    setPayoutMethod('BANK');
                                    setBankName(summary.payoutMethods.bank.holderName || '');
                                    setBankAcc('');
                                    setBankIfsc(summary.payoutMethods.bank.ifsc || '');
                                    setIsEditingPayoutMethod(true);
                                    setPayoutAmount(String(Math.floor(summary?.withdrawableBalance ?? 0)));
                                    setShowPayoutModal(true);
                                }}
                                style={styles.editBtn}
                            >
                                <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {!summary?.payoutMethods?.upiId && (
                        <TouchableOpacity
                            style={styles.addMethodBtn}
                            onPress={() => { setUpiInput(''); setShowUpiModal(true); }}
                        >
                            <Icon name="qrcode-scan" size={18} color="#6366f1" />
                            <Text style={styles.addMethodText}>Add UPI ID for QR Payments</Text>
                            <Icon name="chevron-right" size={16} color="#6366f1" />
                        </TouchableOpacity>
                    )}

                    {!summary?.payoutMethods?.bank && (
                        <TouchableOpacity
                            style={[styles.addMethodBtn, { marginTop: summary?.payoutMethods?.upiId ? 8 : 4, borderColor: 'rgba(201,168,76,0.3)', backgroundColor: 'rgba(201,168,76,0.06)' }]}
                            onPress={() => {
                                setPayoutMethod('BANK');
                                setBankAcc(''); setBankIfsc(''); setBankName('');
                                setIsEditingPayoutMethod(true);
                                setPayoutAmount('100');
                                setShowPayoutModal(true);
                            }}
                        >
                            <Icon name="bank-outline" size={18} color={G.accent} />
                            <Text style={[styles.addMethodText, { color: G.accent }]}>Add Bank Account</Text>
                            <Icon name="chevron-right" size={16} color={G.accent} />
                        </TouchableOpacity>
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
                        const isNegative = tx.amount < 0 || tx.type === 'PLATFORM_FEE';
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
                                <Text style={[
                                    styles.txAmount,
                                    isNegative ? styles.txMinus
                                        : tx.type === 'PAYOUT' && tx.status === 'PROCESSING' ? { color: '#fbbf24' }
                                            : tx.type === 'PAYOUT' && tx.status === 'FAILED' ? { color: '#ef4444' }
                                                : styles.txPlus,
                                ]}>
                                    {tx.type === 'PAYOUT' && tx.status === 'PROCESSING'
                                        ? `⏳ ₹${Math.abs(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                        : tx.type === 'PAYOUT' && tx.status === 'FAILED'
                                            ? `✗ ₹${Math.abs(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                            : `${isNegative ? '−' : '+'}₹${Math.abs(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                    }
                                </Text>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* ── Top-up Modal ── */}
            <Modal visible={showTopupModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Money to Wallet</Text>
                        <Text style={styles.modalHint}>Pay via Cashfree. Amount credits instantly on success.</Text>

                        <TextInput
                            style={styles.modalInput}
                            keyboardType="numeric"
                            placeholder="Enter amount (min ₹50)"
                            placeholderTextColor="#666"
                            value={topupAmount}
                            onChangeText={setTopupAmount}
                            editable={!isTopping}
                        />

                        <View style={styles.quickRow}>
                            {[50, 100, 200, 500].map((v) => (
                                <TouchableOpacity key={v} style={styles.quickBtn} onPress={() => setTopupAmount(String(v))}>
                                    <Text style={styles.quickText}>₹{v}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => { if (!isTopping) setShowTopupModal(false); }}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, { backgroundColor: '#059669' }, isTopping && { opacity: 0.6 }]}
                                onPress={handleTopup}
                                disabled={isTopping}
                            >
                                <Text style={styles.modalConfirmText}>{isTopping ? 'Processing…' : 'Pay Now'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Payout Modal ── */}
            <Modal visible={showPayoutModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {isEditingPayoutMethod ? 'Edit Payout Method' : 'Withdraw Earnings'}
                        </Text>
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
                        <Text style={styles.methodLabel}>Transfer Method</Text>
                        <View style={styles.methodToggleRow}>
                            <TouchableOpacity
                                style={[styles.methodToggle, payoutMethod === 'UPI' && styles.methodToggleActive]}
                                onPress={() => setPayoutMethod('UPI')}
                            >
                                <Icon name="cellphone" size={16} color={payoutMethod === 'UPI' ? '#fff' : '#CCC'} />
                                <Text style={[styles.methodToggleText, payoutMethod === 'UPI' && styles.methodToggleTextActive]}>UPI</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.methodToggle, payoutMethod === 'BANK' && styles.methodToggleActive]}
                                onPress={() => setPayoutMethod('BANK')}
                            >
                                <Icon name="bank" size={16} color={payoutMethod === 'BANK' ? '#fff' : '#CCC'} />
                                <Text style={[styles.methodToggleText, payoutMethod === 'BANK' && styles.methodToggleTextActive]}>Bank</Text>
                            </TouchableOpacity>
                        </View>

                        {payoutMethod === 'UPI' && (!summary?.payoutMethods?.upiId || isEditingPayoutMethod) && (
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Enter your UPI ID (e.g. name@upi)"
                                placeholderTextColor="#666"
                                value={upiId}
                                onChangeText={setUpiId}
                                autoCapitalize="none"
                                editable={!isSubmitting}
                            />
                        )}

                        {payoutMethod === 'BANK' && (!summary?.payoutMethods?.bank || isEditingPayoutMethod) && (
                            <>
                                <TextInput style={styles.modalInput} placeholder="Account Holder Name" placeholderTextColor="#666" value={bankName} onChangeText={setBankName} editable={!isSubmitting} />
                                <TextInput style={styles.modalInput} placeholder="Account Number" placeholderTextColor="#666" value={bankAcc} onChangeText={setBankAcc} keyboardType="numeric" editable={!isSubmitting} />
                                <TextInput style={styles.modalInput} placeholder="IFSC Code" placeholderTextColor="#666" value={bankIfsc} onChangeText={setBankIfsc} autoCapitalize="characters" editable={!isSubmitting} />
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { if (!isSubmitting) { setShowPayoutModal(false); setIsEditingPayoutMethod(false); } }}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalConfirmBtn, isSubmitting && { opacity: 0.6 }]} onPress={handlePayout} disabled={isSubmitting}>
                                <Text style={styles.modalConfirmText}>{isSubmitting ? 'Processing...' : 'Withdraw'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── UPI Save Modal ── */}
            <Modal visible={showUpiModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add UPI ID</Text>
                        <Text style={styles.modalHint}>Customers will scan your QR code and pay directly to this UPI ID after a ride.</Text>
                        <TextInput
                            style={[styles.modalInput, { fontSize: 15 }]}
                            placeholder="e.g. 9999999999@ybl  or  name@okicici"
                            placeholderTextColor="#555"
                            value={upiInput}
                            onChangeText={setUpiInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            editable={!savingUpi}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { if (!savingUpi) setShowUpiModal(false); }}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, { backgroundColor: '#6366f1' }, savingUpi && { opacity: 0.6 }]}
                                disabled={savingUpi}
                                onPress={async () => {
                                    const trimmed = upiInput.trim();
                                    if (!trimmed) { showAlert('Required', 'Please enter your UPI ID'); return; }
                                    if (!trimmed.includes('@')) { showAlert('Invalid UPI ID', 'Must contain @ — e.g. name@okicici'); return; }
                                    setSavingUpi(true);
                                    try {
                                        await saveDriverUpiId(trimmed);
                                        setShowUpiModal(false);
                                        showAlert('✅ UPI ID Saved!', `Customers can now pay you via QR scan to\n${trimmed}`);
                                        fetchData();
                                    } catch (e: any) {
                                        showAlert('Save Failed', e?.message || 'Could not save UPI ID. Try again.');
                                    } finally {
                                        setSavingUpi(false);
                                    }
                                }}
                            >
                                <Text style={styles.modalConfirmText}>Save UPI ID</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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

    // Blocked banner
    blockedBanner: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: '#dc2626', borderRadius: 14, padding: 14, marginBottom: 14,
    },
    blockedTitle: { fontSize: 14, fontWeight: '800', color: '#ffffff', marginBottom: 2 },
    blockedBody: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

    // Balance Card
    balanceCard: { backgroundColor: '#065f46', borderRadius: 20, padding: 24, marginBottom: 14 },
    balanceCardBlocked: { backgroundColor: '#7f1d1d' },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
    balanceValue: { fontSize: 34, fontWeight: '900', color: G.textPrimary, marginTop: 4 },
    balanceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 14 },
    balanceStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    balanceStat: { flex: 1, alignItems: 'center' },
    balanceStatSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
    statValue: { fontSize: 14, fontWeight: '800', color: G.textPrimary, marginTop: 4 },

    // Action row (Add Money + Withdraw)
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    topupBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#059669', borderRadius: 14, paddingVertical: 13, gap: 7,
    },
    withdrawBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#10b981', borderRadius: 14, paddingVertical: 13, gap: 7,
    },
    withdrawBtnDisabled: { backgroundColor: G.textMuted },
    actionBtnText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },

    // Payout Methods
    methodsCard: {
        backgroundColor: G.bg, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: G.border3, marginBottom: 20,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary, marginBottom: 12 },
    methodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    methodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    methodInfo: { flex: 1, marginLeft: 12 },
    methodTitle: { fontSize: 14, fontWeight: '700', color: G.textPrimary },
    methodSub: { fontSize: 12, color: G.textSecondary, marginTop: 1 },
    editBtn: {
        paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 8,
        borderWidth: 1, borderColor: G.borderAccent,
    },
    editBtnText: { fontSize: 12, fontWeight: '700', color: G.accent },
    addMethodBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', marginTop: 4,
    },
    addMethodText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#6366f1' },

    // Transactions
    emptyCard: {
        backgroundColor: G.bg, borderRadius: 16, padding: 32, alignItems: 'center',
        borderWidth: 1, borderColor: G.border3,
    },
    emptyText: { fontSize: 15, fontWeight: '700', color: '#CCCCCC', marginTop: 12 },
    emptyHint: { fontSize: 13, color: G.textMuted, marginTop: 4 },
    txRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: G.bg,
        borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: G.border3,
    },
    txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    txInfo: { flex: 1, marginLeft: 12 },
    txDesc: { fontSize: 13, fontWeight: '600', color: G.textPrimary },
    txSub: { fontSize: 11, color: G.textMuted, marginTop: 1 },
    txDate: { fontSize: 11, color: G.textMuted, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '800' },
    txPlus: { color: '#10b981' },
    txMinus: { color: '#ef4444' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: G.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 20, fontWeight: '900', color: G.textPrimary, marginBottom: 4 },
    modalHint: { fontSize: 13, color: G.textSecondary, marginBottom: 16 },
    modalInput: {
        borderWidth: 1.5, borderColor: G.border3, borderRadius: 12,
        paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700',
        color: G.textPrimary, marginBottom: 14,
    },
    quickRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    quickBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        backgroundColor: G.glass2, alignItems: 'center',
        borderWidth: 1, borderColor: G.border3,
    },
    quickText: { fontSize: 14, fontWeight: '800', color: G.textPrimary },
    methodLabel: { fontSize: 13, fontWeight: '700', color: '#CCCCCC', marginBottom: 8 },
    methodToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    methodToggle: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 12, borderRadius: 12,
        borderWidth: 1.5, borderColor: G.border3, backgroundColor: G.bgAlt,
    },
    methodToggleActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    methodToggleText: { fontSize: 14, fontWeight: '700', color: '#CCCCCC' },
    methodToggleTextActive: { color: G.textPrimary },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: G.glass2, alignItems: 'center' },
    modalCancelText: { fontSize: 15, fontWeight: '800', color: '#CCCCCC' },
    modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center' },
    modalConfirmText: { fontSize: 15, fontWeight: '800', color: G.textPrimary },
});

export default DriverWalletScreen;
