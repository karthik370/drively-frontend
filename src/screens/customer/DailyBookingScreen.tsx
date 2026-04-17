import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

interface Props {
    navigation: any;
}

const DailyBookingScreen = ({ navigation }: Props) => {
    const [selectedDays, setSelectedDays] = useState<number>(5);
    const [selectedSlot, setSelectedSlot] = useState<string>('MORNING');
    const [selectedTime, setSelectedTime] = useState<string>('08:00');

    const slots = [
        { key: 'MORNING', label: 'Morning', time: '6 AM – 12 PM', icon: 'weather-sunny', color: '#f59e0b' },
        { key: 'AFTERNOON', label: 'Afternoon', time: '12 PM – 5 PM', icon: 'weather-partly-cloudy', color: '#f97316' },
        { key: 'EVENING', label: 'Evening', time: '5 PM – 10 PM', icon: 'weather-sunset', color: '#6366f1' },
    ];

    const dayOptions = [3, 5, 7, 10, 15, 30];

    const pricePerDay = 299;
    const totalPrice = selectedDays * pricePerDay;
    const savings = selectedDays >= 7 ? Math.round(totalPrice * 0.1) :
        selectedDays >= 15 ? Math.round(totalPrice * 0.15) :
            selectedDays >= 30 ? Math.round(totalPrice * 0.2) : 0;

    const handleBook = () => {
        showAlert(
            'Confirm Daily Booking',
            `Book a driver for ${selectedDays} days (${slots.find(s => s.key === selectedSlot)?.label} slot)?\n\nTotal: ₹${totalPrice}${savings > 0 ? ` (Save ₹${savings})` : ''}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Book Now',
                    onPress: () => {
                        navigation.navigate('RideConfirm', {
                            dailyBooking: {
                                days: selectedDays,
                                slot: selectedSlot,
                                pricePerDay,
                                totalPrice: totalPrice - savings,
                            },
                        });
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Daily Driver</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Hero */}
                <View style={styles.heroCard}>
                    <Icon name="calendar-clock" size={36} color="#C9A84C" />
                    <Text style={styles.heroTitle}>Same Driver, Every Day</Text>
                    <Text style={styles.heroDesc}>
                        Book a dedicated driver for multiple days. Get the same trusted driver for your daily commute.
                    </Text>
                </View>

                {/* Duration */}
                <Text style={styles.sectionTitle}>How many days?</Text>
                <View style={styles.daysRow}>
                    {dayOptions.map((d) => (
                        <TouchableOpacity
                            key={d}
                            style={[styles.dayChip, selectedDays === d && styles.dayChipActive]}
                            onPress={() => setSelectedDays(d)}
                        >
                            <Text style={[styles.dayText, selectedDays === d && styles.dayTextActive]}>{d}</Text>
                            <Text style={[styles.dayLabel, selectedDays === d && styles.dayLabelActive]}>days</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Time slot */}
                <Text style={styles.sectionTitle}>Preferred Slot</Text>
                <View style={styles.slotsRow}>
                    {slots.map((s) => (
                        <TouchableOpacity
                            key={s.key}
                            style={[styles.slotCard, selectedSlot === s.key && styles.slotCardActive]}
                            onPress={() => setSelectedSlot(s.key)}
                        >
                            <Icon name={s.icon as any} size={24} color={selectedSlot === s.key ? s.color : '#9ca3af'} />
                            <Text style={[styles.slotLabel, selectedSlot === s.key && { color: G.textPrimary }]}>{s.label}</Text>
                            <Text style={styles.slotTime}>{s.time}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Pricing */}
                <View style={styles.priceCard}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Rate per day</Text>
                        <Text style={styles.priceValue}>₹{pricePerDay}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>{selectedDays} days</Text>
                        <Text style={styles.priceValue}>₹{totalPrice}</Text>
                    </View>
                    {savings > 0 ? (
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceLabel, { color: '#16a34a' }]}>Multi-day discount</Text>
                            <Text style={[styles.priceValue, { color: '#16a34a' }]}>-₹{savings}</Text>
                        </View>
                    ) : null}
                    <View style={styles.priceDivider} />
                    <View style={styles.priceRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₹{totalPrice - savings}</Text>
                    </View>
                </View>

                {/* Benefits */}
                <View style={styles.benefitsCard}>
                    <Text style={styles.benefitsTitle}>Benefits</Text>
                    {[
                        { icon: 'account-check', text: 'Same trusted driver every day' },
                        { icon: 'clock-check', text: 'Driver arrives on time, every day' },
                        { icon: 'tag', text: 'Multi-day discounts up to 20%' },
                        { icon: 'cancel', text: 'Free cancellation up to 24 hours before' },
                    ].map((b, i) => (
                        <View key={i} style={styles.benefitRow}>
                            <Icon name={b.icon as any} size={16} color="#10b981" />
                            <Text style={styles.benefitText}>{b.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Book button */}
                <TouchableOpacity style={styles.bookBtn} onPress={handleBook} activeOpacity={0.7}>
                    <Text style={styles.bookBtnText}>Book Daily Driver</Text>
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

    heroCard: {
        backgroundColor: G.glass2, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20,
        borderWidth: 1, borderColor: '#bfdbfe',
    },
    heroTitle: { fontSize: 18, fontWeight: '900', color: '#1e40af', marginTop: 10 },
    heroDesc: { fontSize: 13, color: G.accent, textAlign: 'center', marginTop: 6, lineHeight: 20 },

    sectionTitle: { fontSize: 15, fontWeight: '900', color: G.textPrimary, marginBottom: 10 },

    daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    dayChip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
        backgroundColor: G.bg, borderWidth: 1.5, borderColor: G.border3,
    },
    dayChipActive: { borderColor: G.accent, backgroundColor: G.glass2 },
    dayText: { fontSize: 18, fontWeight: '900', color: '#CCCCCC' },
    dayTextActive: { color: G.accent },
    dayLabel: { fontSize: 10, fontWeight: '600', color: G.textMuted },
    dayLabelActive: { color: G.accent },

    slotsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    slotCard: {
        flex: 1, backgroundColor: G.bg, borderRadius: 12, padding: 12, alignItems: 'center',
        borderWidth: 1.5, borderColor: G.border3, gap: 4,
    },
    slotCardActive: { borderColor: G.accent, backgroundColor: G.glass2 },
    slotLabel: { fontSize: 12, fontWeight: '800', color: G.textMuted },
    slotTime: { fontSize: 10, color: G.textMuted },

    priceCard: {
        backgroundColor: G.bg, borderRadius: 14, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: G.border3,
    },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    priceLabel: { fontSize: 13, color: G.textSecondary, fontWeight: '600' },
    priceValue: { fontSize: 13, color: G.textPrimary, fontWeight: '700' },
    priceDivider: { height: 1, backgroundColor: G.glass3, marginVertical: 8 },
    totalLabel: { fontSize: 15, fontWeight: '900', color: G.textPrimary },
    totalValue: { fontSize: 18, fontWeight: '900', color: G.textPrimary },

    benefitsCard: {
        backgroundColor: G.glass2, borderRadius: 14, padding: 16, marginBottom: 20,
        borderWidth: 1, borderColor: '#bbf7d0',
    },
    benefitsTitle: { fontSize: 14, fontWeight: '800', color: '#065f46', marginBottom: 10 },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    benefitText: { fontSize: 13, color: '#065f46', fontWeight: '600' },

    bookBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: G.accent, borderRadius: 14, padding: 16,
        elevation: 4, shadowColor: G.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6,
    },
    bookBtnText: { fontSize: 15, fontWeight: '900', color: G.textPrimary },
});

export default DailyBookingScreen;
