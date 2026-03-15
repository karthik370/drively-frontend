import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppSelector } from '../../redux/store';

interface Props {
    navigation: any;
    route: any;
}

const RideReceiptScreen = ({ navigation, route }: Props) => {
    const booking = route?.params?.booking;
    const breakdown = booking?.pricingBreakdown || booking?.breakdown || booking?.fareBreakdown || {};
    const authedUserId = useAppSelector((s) => s.auth.user?.id ?? null);
    const roleOverride = useAppSelector((s) => s.auth.roleOverride);

    // Determine role — respect customer mode override
    const isDriver = Boolean(
        authedUserId &&
        booking?.driverId &&
        String(authedUserId) === String(booking.driverId) &&
        roleOverride !== 'CUSTOMER'  // If in customer mode, always show customer receipt
    );

    const fareItems: { label: string; value: string; icon: string; highlight?: boolean }[] = [];

    // Build fare breakdown
    const baseAmount = Number(breakdown?.baseAmount || breakdown?.packagePrice || 0);
    if (baseAmount > 0) fareItems.push({ label: 'Base fare', value: `₹${Math.round(baseAmount)}`, icon: 'cash' });

    const extraKm = Number(breakdown?.extraKmCharge || 0);
    if (extraKm > 0) fareItems.push({ label: 'Extra km charges', value: `₹${Math.round(extraKm)}`, icon: 'road-variant' });

    const extraMin = Number(breakdown?.extraMinuteCharge || 0);
    if (extraMin > 0) fareItems.push({ label: 'Extra minute charges', value: `₹${Math.round(extraMin)}`, icon: 'clock-outline' });

    const nightCharge = Number(breakdown?.nightCharge || 0);
    if (nightCharge > 0) fareItems.push({ label: 'Night charge', value: `₹${Math.round(nightCharge)}`, icon: 'weather-night' });

    const oneWayCharge = Number(breakdown?.oneWayCharge || 0);
    if (oneWayCharge > 0) fareItems.push({ label: 'One-way charge', value: `₹${Math.round(oneWayCharge)}`, icon: 'arrow-right' });

    const convFee = Number(breakdown?.convenienceFee || breakdown?.taxes || 0);
    if (convFee > 0) fareItems.push({ label: 'Convenience fee & taxes', value: `₹${Math.round(convFee)}`, icon: 'receipt' });

    const discount = Number(breakdown?.discount || 0);
    if (discount > 0) fareItems.push({ label: 'Discount', value: `-₹${Math.round(discount)}`, icon: 'tag' });

    const tipAmount = Number(booking?.tipAmount || 0);
    if (tipAmount > 0) fareItems.push({ label: 'Driver tip', value: `₹${Math.round(tipAmount)}`, icon: 'hand-heart' });

    const total = Number(booking?.totalAmount || 0);
    const driverEarnings = Number(booking?.driverEarnings || 0);
    const commission = Number(booking?.platformCommission || 0);
    const paymentMethod = String(booking?.paymentMethod || 'CASH');
    const tripType = String(booking?.tripType || 'ONE_WAY').replace(/_/g, ' ');
    const bookingNumber = String(booking?.bookingNumber || '—');
    const pickupAddr = String(booking?.pickupAddress || '—');
    const dropAddr = String(booking?.dropAddress || '—');
    const createdAt = booking?.createdAt ? new Date(booking.createdAt) : null;
    const completedAt = booking?.completedAt ? new Date(booking.completedAt) : null;

    const payMethodIcon = paymentMethod === 'CASH' ? 'cash' : paymentMethod === 'UPI' ? 'cellphone' : paymentMethod === 'WALLET' ? 'wallet' : 'credit-card';
    const payMethodLabel = paymentMethod === 'CASH' ? 'Cash' : paymentMethod === 'UPI' ? 'UPI' : paymentMethod === 'WALLET' ? 'Wallet' : 'Card';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isDriver ? 'Trip Summary' : 'Ride Receipt'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Total card */}
                <View style={[styles.totalCard, isDriver && { borderColor: '#10b981', borderWidth: 1 }]}>
                    <Icon
                        name={isDriver ? 'wallet' : 'check-circle'}
                        size={36}
                        color={isDriver ? '#10b981' : '#10b981'}
                    />
                    <Text style={styles.totalLabel}>
                        {isDriver ? 'Your Earnings' : 'Total Paid'}
                    </Text>
                    <Text style={styles.totalAmount}>
                        ₹{Math.round(isDriver ? driverEarnings : total)}
                    </Text>
                    <View style={styles.payMethodChip}>
                        <Icon name={payMethodIcon} size={14} color="#6366f1" />
                        <Text style={styles.payMethodText}>
                            {isDriver
                                ? `Customer paid via ${payMethodLabel}`
                                : `Paid via ${payMethodLabel}`}
                        </Text>
                    </View>
                </View>

                {/* Driver-specific: commission & total fare info */}
                {isDriver ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Earnings Breakdown</Text>
                        <View style={styles.fareRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Icon name="cash-multiple" size={16} color="#8A8A8A" />
                                <Text style={styles.fareLabel}>Total ride fare</Text>
                            </View>
                            <Text style={styles.fareValue}>₹{Math.round(total)}</Text>
                        </View>
                        {commission > 0 ? (
                            <View style={styles.fareRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <Icon name="percent" size={16} color="#8A8A8A" />
                                    <Text style={styles.fareLabel}>Platform commission</Text>
                                </View>
                                <Text style={[styles.fareValue, { color: '#ef4444' }]}>-₹{Math.round(commission)}</Text>
                            </View>
                        ) : null}
                        <View style={styles.fareDivider} />
                        <View style={styles.fareRow}>
                            <Text style={styles.fareTotalLabel}>Your earnings</Text>
                            <Text style={[styles.fareTotalValue, { color: '#10b981' }]}>₹{Math.round(driverEarnings)}</Text>
                        </View>
                        {commission === 0 ? (
                            <View style={[styles.fareRow, { backgroundColor: '#141414', borderRadius: 8, paddingHorizontal: 8, marginTop: 4 }]}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>0% platform fee — you keep everything!</Text>
                            </View>
                        ) : null}
                        {paymentMethod === 'CASH' ? (
                            <View style={[styles.fareRow, { backgroundColor: '#1A170A', borderRadius: 8, paddingHorizontal: 8, marginTop: 4 }]}>
                                <Icon name="cash" size={14} color="#f59e0b" />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#f59e0b', marginLeft: 6 }}>Cash collected — not added to wallet</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* Booking info */}
                <View style={styles.card}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Booking #</Text>
                        <Text style={styles.infoValue}>{bookingNumber}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Trip Type</Text>
                        <Text style={styles.infoValue}>{tripType}</Text>
                    </View>
                    {createdAt ? (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Booked</Text>
                            <Text style={styles.infoValue}>{createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                    ) : null}
                    {completedAt ? (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Completed</Text>
                            <Text style={styles.infoValue}>{completedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Route */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Route</Text>
                    <View style={styles.routeRow}>
                        <View style={styles.dotGreen} />
                        <Text style={styles.routeText} numberOfLines={2}>{pickupAddr}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                        <View style={styles.dotRed} />
                        <Text style={styles.routeText} numberOfLines={2}>{dropAddr}</Text>
                    </View>
                </View>

                {/* Customer: Fare breakdown */}
                {!isDriver ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Fare Breakdown</Text>
                        {fareItems.map((item, i) => (
                            <View key={i} style={styles.fareRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <Icon name={item.icon as any} size={16} color="#8A8A8A" />
                                    <Text style={styles.fareLabel}>{item.label}</Text>
                                </View>
                                <Text style={[styles.fareValue, item.value.startsWith('-') && { color: '#10b981' }]}>{item.value}</Text>
                            </View>
                        ))}
                        <View style={styles.fareDivider} />
                        <View style={styles.fareRow}>
                            <Text style={styles.fareTotalLabel}>Total</Text>
                            <Text style={styles.fareTotalValue}>₹{Math.round(total)}</Text>
                        </View>
                    </View>
                ) : null}
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

    totalCard: {
        backgroundColor: '#0A0A0A', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 12,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6,
    },
    totalLabel: { fontSize: 13, fontWeight: '700', color: '#8A8A8A', marginTop: 8 },
    totalAmount: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
    payMethodChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
        backgroundColor: 'rgba(139,92,246,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    payMethodText: { fontSize: 12, fontWeight: '700', color: '#6366f1' },

    card: {
        backgroundColor: '#0A0A0A', borderRadius: 14, padding: 16, marginBottom: 12,
        elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
    },
    cardTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },

    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    infoLabel: { fontSize: 13, color: '#8A8A8A', fontWeight: '600' },
    infoValue: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },

    routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginTop: 4 },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginTop: 4 },
    routeLine: { width: 2, height: 14, backgroundColor: '#1E1E1E', marginLeft: 4, marginVertical: 2 },
    routeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#CCCCCC' },

    fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    fareLabel: { fontSize: 13, color: '#8A8A8A', fontWeight: '600' },
    fareValue: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
    fareDivider: { height: 1, backgroundColor: '#1E1E1E', marginVertical: 6 },
    fareTotalLabel: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
    fareTotalValue: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
});

export default RideReceiptScreen;
