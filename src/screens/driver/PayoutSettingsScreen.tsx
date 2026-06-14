import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';
import { getDriverWalletSummary, saveDriverUpiId } from '../../services/api';

const PayoutSettingsScreen = ({ navigation }: any) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // UPI
    const [upiId, setUpiId] = useState('');
    const [savedUpiId, setSavedUpiId] = useState<string | null>(null);

    // Bank (display-only for now — payout modal handles bank edits)
    const [savedBank, setSavedBank] = useState<{ accountNumber: string; ifsc: string | null; holderName: string | null } | null>(null);

    // Load existing settings
    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            const summary = await getDriverWalletSummary();
            if (summary?.payoutMethods?.upiId) {
                setSavedUpiId(summary.payoutMethods.upiId);
                setUpiId(summary.payoutMethods.upiId);
            }
            if (summary?.payoutMethods?.bank) {
                setSavedBank(summary.payoutMethods.bank);
            }
        } catch (e: any) {
            // Non-critical
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadSettings(); }, [loadSettings]);

    const saveUpi = async () => {
        const trimmed = upiId.trim();
        if (!trimmed) {
            return showAlert('Missing UPI ID', 'Please enter your UPI ID (e.g. 9999999999@ybl or name@okicici)');
        }
        if (!trimmed.includes('@')) {
            return showAlert('Invalid UPI ID', 'UPI ID must contain @\nExample: yourname@upi  or  9999999999@ybl');
        }
        setSaving(true);
        try {
            await saveDriverUpiId(trimmed);
            setSavedUpiId(trimmed);
            showAlert('✅ UPI ID Saved', `UPI ID "${trimmed}" saved successfully!\n\nCustomers can now pay you by scanning your QR code.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (e: any) {
            showAlert('Save Failed', e?.message || 'Could not save UPI ID. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Icon name="arrow-left" size={22} color="#C9A84C" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Payout Settings</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={G.accent} />
                    <Text style={{ color: G.textSecondary, marginTop: 12 }}>Loading your settings…</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payout Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                    {/* ── UPI Section ─────────────────────────────────────────── */}
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Icon name="cellphone" size={20} color="#6366f1" />
                            <Text style={styles.sectionTitle}>UPI ID</Text>
                            {savedUpiId ? (
                                <View style={styles.savedBadge}>
                                    <Icon name="check-circle" size={13} color="#10b981" />
                                    <Text style={styles.savedBadgeText}>Saved</Text>
                                </View>
                            ) : (
                                <View style={[styles.savedBadge, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
                                    <Icon name="alert-circle-outline" size={13} color="#f59e0b" />
                                    <Text style={[styles.savedBadgeText, { color: '#f59e0b' }]}>Not set</Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.inputLabel}>Your UPI ID</Text>
                        <TextInput
                            style={styles.input}
                            value={upiId}
                            onChangeText={setUpiId}
                            placeholder="e.g. 9999999999@ybl  or  name@okicici"
                            placeholderTextColor="#555"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            returnKeyType="done"
                            onSubmitEditing={saveUpi}
                        />

                        <Text style={styles.hint}>
                            This UPI ID is used when customers scan the QR code to pay you after a ride.
                        </Text>

                        <TouchableOpacity
                            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                            onPress={saveUpi}
                            disabled={saving}
                            activeOpacity={0.8}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Icon name="content-save" size={18} color="#fff" />
                                    <Text style={styles.saveBtnText}>
                                        {savedUpiId ? 'Update UPI ID' : 'Save UPI ID'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* ── Bank Account Section (read-only display) ────────────── */}
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Icon name="bank" size={20} color={G.accent} />
                            <Text style={styles.sectionTitle}>Bank Account</Text>
                            {savedBank ? (
                                <View style={styles.savedBadge}>
                                    <Icon name="check-circle" size={13} color="#10b981" />
                                    <Text style={styles.savedBadgeText}>Saved</Text>
                                </View>
                            ) : (
                                <View style={[styles.savedBadge, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
                                    <Icon name="alert-circle-outline" size={13} color="#f59e0b" />
                                    <Text style={[styles.savedBadgeText, { color: '#f59e0b' }]}>Not set</Text>
                                </View>
                            )}
                        </View>

                        {savedBank ? (
                            <View style={styles.bankRow}>
                                <Icon name="credit-card-outline" size={16} color={G.textSecondary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.bankValue}>{savedBank.holderName || 'Account Holder'}</Text>
                                    <Text style={styles.bankSub}>
                                        {savedBank.accountNumber}  •  {savedBank.ifsc || '—'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <Text style={styles.hint}>
                                No bank account saved. Add bank details when requesting a withdrawal from the Wallet screen.
                            </Text>
                        )}
                    </View>

                    {/* ── Info Card ─────────────────────────────────────────────── */}
                    <View style={styles.infoCard}>
                        <Icon name="information-outline" size={16} color="#6366f1" />
                        <Text style={styles.infoText}>
                            Your UPI ID is only used so customers can pay you directly via QR scan after a ride.
                            It is never shared publicly and is only visible to the app.
                        </Text>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
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
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
    content: { padding: 16, paddingBottom: 40 },

    sectionCard: {
        backgroundColor: G.bg, borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1, borderColor: G.border3,
    },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
    },
    sectionTitle: { fontSize: 15, fontWeight: '900', color: G.textPrimary, flex: 1 },

    savedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 20,
    },
    savedBadgeText: { fontSize: 11, fontWeight: '700', color: '#10b981' },

    inputLabel: { fontSize: 12, fontWeight: '700', color: G.textSecondary, marginBottom: 6 },
    input: {
        borderWidth: 1.5, borderColor: G.border3, borderRadius: 12, padding: 13,
        fontSize: 14, fontWeight: '600', color: G.textPrimary, marginBottom: 8,
    },
    hint: { fontSize: 12, color: G.textSecondary, lineHeight: 17, marginBottom: 14 },

    saveBtn: {
        backgroundColor: '#6366f1', borderRadius: 12, padding: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },

    bankRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: G.glass2, borderRadius: 10, padding: 12,
    },
    bankValue: { fontSize: 13, fontWeight: '700', color: G.textPrimary },
    bankSub: { fontSize: 12, color: G.textSecondary, marginTop: 2 },

    infoCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 12, padding: 14, marginTop: 4,
    },
    infoText: { flex: 1, fontSize: 12, color: '#6366f1', fontWeight: '600', lineHeight: 18 },
});

export default PayoutSettingsScreen;
