import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

interface AirportTerminal {
    id: string;
    name: string;
    code: string;
}

const AIRPORTS: { city: string; code: string; terminals: AirportTerminal[] }[] = [
    {
        city: 'Hyderabad',
        code: 'HYD',
        terminals: [
            { id: 'hyd-d', name: 'Domestic Terminal', code: 'T-D' },
            { id: 'hyd-i', name: 'International Terminal', code: 'T-I' },
        ],
    },
    {
        city: 'Bangalore',
        code: 'BLR',
        terminals: [
            { id: 'blr-1', name: 'Terminal 1 (Domestic)', code: 'T1' },
            { id: 'blr-2', name: 'Terminal 2 (International)', code: 'T2' },
        ],
    },
    {
        city: 'Delhi',
        code: 'DEL',
        terminals: [
            { id: 'del-1d', name: 'Terminal 1D', code: 'T1D' },
            { id: 'del-2', name: 'Terminal 2', code: 'T2' },
            { id: 'del-3', name: 'Terminal 3', code: 'T3' },
        ],
    },
    {
        city: 'Mumbai',
        code: 'BOM',
        terminals: [
            { id: 'bom-1', name: 'Terminal 1 (Domestic)', code: 'T1' },
            { id: 'bom-2', name: 'Terminal 2 (International)', code: 'T2' },
        ],
    },
    {
        city: 'Chennai',
        code: 'MAA',
        terminals: [
            { id: 'maa-1', name: 'Domestic Terminal', code: 'T1' },
            { id: 'maa-4', name: 'International Terminal', code: 'T4' },
        ],
    },
];

interface Props {
    navigation: any;
}

const AirportTransferScreen = ({ navigation }: Props) => {
    const [transferType, setTransferType] = useState<'PICKUP' | 'DROP'>('PICKUP');
    const [selectedAirport, setSelectedAirport] = useState<number | null>(null);
    const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
    const [flightNumber, setFlightNumber] = useState('');

    const airport = selectedAirport !== null ? AIRPORTS[selectedAirport] : null;

    const handleContinue = () => {
        if (!airport || !selectedTerminal) {
            return showAlert('Select terminal', 'Please select an airport and terminal');
        }
        const terminal = airport.terminals.find((t) => t.id === selectedTerminal);
        const label = `${airport.city} Airport (${terminal?.code || ''})`;

        navigation.navigate('RideConfirm', {
            airportTransfer: {
                type: transferType,
                airportCode: airport.code,
                terminalId: selectedTerminal,
                terminalName: terminal?.name,
                flightNumber: flightNumber.trim() || undefined,
                addressLabel: label,
            },
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top','bottom']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Airport Transfer</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Transfer type */}
                <Text style={styles.sectionTitle}>Transfer Type</Text>
                <View style={styles.typeRow}>
                    <TouchableOpacity
                        style={[styles.typeCard, transferType === 'PICKUP' && styles.typeCardActive]}
                        onPress={() => setTransferType('PICKUP')}
                    >
                        <Icon name="airplane-landing" size={28} color={transferType === 'PICKUP' ? '#2563eb' : '#9ca3af'} />
                        <Text style={[styles.typeLabel, transferType === 'PICKUP' && styles.typeLabelActive]}>Airport Pickup</Text>
                        <Text style={styles.typeDesc}>Driver picks you from airport</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeCard, transferType === 'DROP' && styles.typeCardActive]}
                        onPress={() => setTransferType('DROP')}
                    >
                        <Icon name="airplane-takeoff" size={28} color={transferType === 'DROP' ? '#2563eb' : '#9ca3af'} />
                        <Text style={[styles.typeLabel, transferType === 'DROP' && styles.typeLabelActive]}>Airport Drop</Text>
                        <Text style={styles.typeDesc}>Driver drops you at airport</Text>
                    </TouchableOpacity>
                </View>

                {/* Airport selection */}
                <Text style={styles.sectionTitle}>Select Airport</Text>
                {AIRPORTS.map((ap, i) => (
                    <TouchableOpacity
                        key={ap.code}
                        style={[styles.airportRow, selectedAirport === i && styles.airportRowActive]}
                        onPress={() => { setSelectedAirport(i); setSelectedTerminal(null); }}
                    >
                        <Icon name="airplane" size={18} color={selectedAirport === i ? '#2563eb' : '#6b7280'} />
                        <Text style={[styles.airportName, selectedAirport === i && { color: G.accent }]}>
                            {ap.city} ({ap.code})
                        </Text>
                        {selectedAirport === i ? <Icon name="check-circle" size={18} color="#C9A84C" /> : null}
                    </TouchableOpacity>
                ))}

                {/* Terminal selection */}
                {airport ? (
                    <>
                        <Text style={styles.sectionTitle}>Select Terminal</Text>
                        {airport.terminals.map((t) => (
                            <TouchableOpacity
                                key={t.id}
                                style={[styles.terminalRow, selectedTerminal === t.id && styles.terminalRowActive]}
                                onPress={() => setSelectedTerminal(t.id)}
                            >
                                <View style={[styles.terminalDot, selectedTerminal === t.id && styles.terminalDotActive]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.terminalName, selectedTerminal === t.id && { color: G.accent }]}>
                                        {t.name}
                                    </Text>
                                    <Text style={styles.terminalCode}>{t.code}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </>
                ) : null}

                {/* Flight number */}
                {airport ? (
                    <View style={styles.flightCard}>
                        <Text style={styles.inputLabel}>Flight Number (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={flightNumber}
                            onChangeText={setFlightNumber}
                            placeholder="e.g. 6E 2042"
                            autoCapitalize="characters"
                            placeholderTextColor="#444444"
                        />
                        <Text style={styles.flightHint}>We'll track your flight for better timing</Text>
                    </View>
                ) : null}

                {/* Continue */}
                <TouchableOpacity
                    style={[styles.continueBtn, (!airport || !selectedTerminal) && { opacity: 0.5 }]}
                    onPress={handleContinue}
                    disabled={!airport || !selectedTerminal}
                    activeOpacity={0.7}
                >
                    <Text style={styles.continueBtnText}>Continue to Book</Text>
                    <Icon name="arrow-right" size={18} color="#ffffff" />
                </TouchableOpacity>
            </ScrollView>
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
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
    content: { padding: 16, paddingBottom: 32 },

    sectionTitle: { fontSize: 15, fontWeight: '900', color: G.textPrimary, marginBottom: 10, marginTop: 16 },

    typeRow: { flexDirection: 'row', gap: 10 },
    typeCard: {
        flex: 1, backgroundColor: G.bg, borderRadius: 14, padding: 16, alignItems: 'center',
        borderWidth: 1.5, borderColor: G.border3, gap: 6,
    },
    typeCardActive: { borderColor: G.accent, backgroundColor: G.glass2 },
    typeLabel: { fontSize: 13, fontWeight: '800', color: '#CCCCCC' },
    typeLabelActive: { color: G.accent },
    typeDesc: { fontSize: 11, color: G.textMuted, textAlign: 'center' },

    airportRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: G.bg, borderRadius: 10, padding: 14, marginBottom: 6,
        borderWidth: 1, borderColor: G.border3,
    },
    airportRowActive: { borderColor: G.accent, backgroundColor: G.glass2 },
    airportName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#CCCCCC' },

    terminalRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: G.bg, borderRadius: 10, padding: 14, marginBottom: 6,
        borderWidth: 1, borderColor: G.border3,
    },
    terminalRowActive: { borderColor: G.accent, backgroundColor: G.glass2 },
    terminalDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: G.border3 },
    terminalDotActive: { borderColor: G.accent, backgroundColor: G.accent },
    terminalName: { fontSize: 13, fontWeight: '700', color: '#CCCCCC' },
    terminalCode: { fontSize: 11, color: G.textMuted, marginTop: 1 },

    flightCard: { backgroundColor: G.bg, borderRadius: 14, padding: 16, marginTop: 8 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: G.textSecondary, marginBottom: 6 },
    input: {
        borderWidth: 1.5, borderColor: G.border3, borderRadius: 10, padding: 12,
        fontSize: 14, fontWeight: '600', color: G.textPrimary,
    },
    flightHint: { fontSize: 11, color: G.textMuted, marginTop: 6 },

    continueBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: G.accent, borderRadius: 14, padding: 16, marginTop: 24,
        elevation: 4, shadowColor: G.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6,
    },
    continueBtnText: { fontSize: 15, fontWeight: '900', color: G.textPrimary },
});

export default AirportTransferScreen;
