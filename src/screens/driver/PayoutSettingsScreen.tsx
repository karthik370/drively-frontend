import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface PayoutSettings {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    bankAccount?: { name: string; number: string; ifsc: string };
    upiId?: string;
}

const PayoutSettingsScreen = ({ navigation }: any) => {
    const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
    const [payoutMethod, setPayoutMethod] = useState<'BANK' | 'UPI'>('BANK');
    const [bankName, setBankName] = useState('');
    const [bankNumber, setBankNumber] = useState('');
    const [ifsc, setIfsc] = useState('');
    const [upiId, setUpiId] = useState('');
    const [saving, setSaving] = useState(false);

    const saveSettings = async () => {
        if (payoutMethod === 'BANK' && (!bankNumber || !ifsc)) {
            return Alert.alert('Missing details', 'Please fill in bank account number and IFSC code');
        }
        if (payoutMethod === 'UPI' && !upiId) {
            return Alert.alert('Missing UPI ID', 'Please enter your UPI ID');
        }
        setSaving(true);
        // In production, this would call backend API
        setTimeout(() => {
            setSaving(false);
            Alert.alert('Settings saved', `Payouts will be processed ${frequency.toLowerCase()}.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        }, 800);
    };

    const frequencies: { key: 'DAILY' | 'WEEKLY' | 'MONTHLY'; label: string; desc: string; icon: string }[] = [
        { key: 'DAILY', label: 'Daily', desc: 'Get paid every day at 11 PM', icon: 'calendar-today' },
        { key: 'WEEKLY', label: 'Weekly', desc: 'Get paid every Monday', icon: 'calendar-week' },
        { key: 'MONTHLY', label: 'Monthly', desc: 'Get paid on 1st of every month', icon: 'calendar-month' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payout Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Payout frequency */}
                <Text style={styles.sectionTitle}>Payout Frequency</Text>
                <View style={styles.freqRow}>
                    {frequencies.map((f) => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.freqCard, frequency === f.key && styles.freqCardActive]}
                            onPress={() => setFrequency(f.key)}
                        >
                            <Icon name={f.icon as any} size={22} color={frequency === f.key ? '#2563eb' : '#9ca3af'} />
                            <Text style={[styles.freqLabel, frequency === f.key && styles.freqLabelActive]}>{f.label}</Text>
                            <Text style={styles.freqDesc}>{f.desc}</Text>
                            {frequency === f.key ? (
                                <View style={styles.checkMark}>
                                    <Icon name="check" size={12} color="#ffffff" />
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Payout method */}
                <Text style={styles.sectionTitle}>Payout Method</Text>
                <View style={styles.methodRow}>
                    <TouchableOpacity
                        style={[styles.methodChip, payoutMethod === 'BANK' && styles.methodChipActive]}
                        onPress={() => setPayoutMethod('BANK')}
                    >
                        <Icon name="bank" size={18} color={payoutMethod === 'BANK' ? '#2563eb' : '#6b7280'} />
                        <Text style={[styles.methodText, payoutMethod === 'BANK' && styles.methodTextActive]}>Bank Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.methodChip, payoutMethod === 'UPI' && styles.methodChipActive]}
                        onPress={() => setPayoutMethod('UPI')}
                    >
                        <Icon name="cellphone" size={18} color={payoutMethod === 'UPI' ? '#2563eb' : '#6b7280'} />
                        <Text style={[styles.methodText, payoutMethod === 'UPI' && styles.methodTextActive]}>UPI</Text>
                    </TouchableOpacity>
                </View>

                {/* Bank details */}
                {payoutMethod === 'BANK' ? (
                    <View style={styles.formCard}>
                        <Text style={styles.inputLabel}>Account Holder Name</Text>
                        <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="Your name" placeholderTextColor="#444444" />
                        <Text style={styles.inputLabel}>Account Number</Text>
                        <TextInput style={styles.input} value={bankNumber} onChangeText={setBankNumber} placeholder="Account number" keyboardType="numeric" placeholderTextColor="#444444" />
                        <Text style={styles.inputLabel}>IFSC Code</Text>
                        <TextInput style={styles.input} value={ifsc} onChangeText={setIfsc} placeholder="IFSC code" autoCapitalize="characters" placeholderTextColor="#444444" />
                    </View>
                ) : (
                    <View style={styles.formCard}>
                        <Text style={styles.inputLabel}>UPI ID</Text>
                        <TextInput style={styles.input} value={upiId} onChangeText={setUpiId} placeholder="yourname@upi" autoCapitalize="none" placeholderTextColor="#444444" />
                    </View>
                )}

                {/* Save */}
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={saveSettings} disabled={saving} activeOpacity={0.7}>
                    <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Settings'}</Text>
                </TouchableOpacity>

                {/* Info */}
                <View style={styles.infoCard}>
                    <Icon name="information" size={16} color="#6366f1" />
                    <Text style={styles.infoText}>
                        Minimum payout amount is ₹100. Payouts below this threshold will be carried forward to the next cycle.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
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

    sectionTitle: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', marginBottom: 10, marginTop: 8 },

    freqRow: { gap: 8, marginBottom: 16 },
    freqCard: {
        flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        backgroundColor: '#0A0A0A', borderRadius: 12, padding: 14,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    },
    freqCardActive: { borderColor: '#C9A84C', backgroundColor: '#141414' },
    freqLabel: { fontSize: 14, fontWeight: '800', color: '#CCCCCC', minWidth: 60 },
    freqLabelActive: { color: '#C9A84C' },
    freqDesc: { flex: 1, fontSize: 12, color: '#8A8A8A' },
    checkMark: {
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#C9A84C',
        alignItems: 'center', justifyContent: 'center',
    },

    methodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    methodChip: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: '#0A0A0A', borderRadius: 12, padding: 14,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    },
    methodChipActive: { borderColor: '#C9A84C', backgroundColor: '#141414' },
    methodText: { fontSize: 13, fontWeight: '700', color: '#8A8A8A' },
    methodTextActive: { color: '#C9A84C' },

    formCard: { backgroundColor: '#0A0A0A', borderRadius: 14, padding: 16, gap: 8, marginBottom: 16 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: '#8A8A8A' },
    input: {
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: 12,
        fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 4,
    },

    saveBtn: {
        backgroundColor: '#C9A84C', borderRadius: 14, padding: 16, alignItems: 'center',
        elevation: 4, shadowcolor: '#C9A84C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6,
    },
    saveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },

    infoCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: 12, padding: 12, marginTop: 16,
    },
    infoText: { flex: 1, fontSize: 12, color: '#6366f1', fontWeight: '600', lineHeight: 18 },
});

export default PayoutSettingsScreen;
