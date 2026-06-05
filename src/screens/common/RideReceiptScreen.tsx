import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAppSelector } from '../../redux/store';
import { getInvoicePdfUrl } from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';
import * as SecureStore from 'expo-secure-store';

interface Props {
    navigation: any;
    route: any;
}

const RideReceiptScreen = ({ navigation, route }: Props) => {
    const booking = route?.params?.booking;
    const breakdown = booking?.pricingBreakdown || booking?.breakdown || booking?.fareBreakdown || {};
    const discounts = breakdown?.discounts || {};
    const authedUserId = useAppSelector((s) => s.auth.user?.id ?? null);
    const roleOverride = useAppSelector((s) => s.auth.roleOverride);
    const [downloading, setDownloading] = useState(false);

    const isDriver = Boolean(
        authedUserId &&
        booking?.driverId &&
        String(authedUserId) === String(booking.driverId) &&
        roleOverride !== 'CUSTOMER'
    );

    const total = Number(booking?.totalAmount || 0);
    const driverEarnings = Number(booking?.driverEarnings || 0);
    const commission = Number(booking?.platformCommission || 0);
    const paymentMethod = String(booking?.paymentMethod || 'CASH');
    const tripType = String(booking?.tripType || 'ONE_WAY');
    const tripTypeLabel = tripType.replace(/_/g, ' ');
    const bookingNumber = String(booking?.bookingNumber || '—');
    const pickupAddr = String(booking?.pickupAddress || '—');
    const dropAddr = String(booking?.dropAddress || '—');
    const createdAt = booking?.createdAt ? new Date(booking.createdAt) : null;
    const completedAt = booking?.completedAt ? new Date(booking.completedAt) : null;

    const payMethodIcon = paymentMethod === 'CASH' ? 'cash' : paymentMethod === 'UPI' ? 'cellphone' : paymentMethod === 'WALLET' ? 'wallet' : 'credit-card';
    const payMethodLabel = paymentMethod === 'CASH' ? 'Cash' : paymentMethod === 'UPI' ? 'UPI' : paymentMethod === 'WALLET' ? 'Wallet' : 'Card';

    // ─────────────────────────────────────────────────────────────────────────
    // EXACT fare formula (verified against backend pricing.ts):
    //   packagePrice + oneWayCharge + extraKmCharge + extraMinuteCharge
    //   + extraHourCharge + extraReturnKmCharge         ← "extras"
    //   + nightCharge + taxesFee                        ← added on top
    //   − discountAmount                                ← promoDiscount + membership + streak
    //   + experiencedDriverFee                          ← optional add-on
    //   = totalAmount (booking.totalAmount)
    // ─────────────────────────────────────────────────────────────────────────

    // Base package
    const packagePrice      = Number(breakdown?.packagePrice || 0);
    const packageHours      = Number(breakdown?.packageHours || 0);
    const distanceKm        = Number(breakdown?.distanceKm || booking?.estimatedDistance || 0);

    // One-way distance charge (LOCAL_HOURLY & OUTSTATION_ONE_WAY)
    const oneWayCharge      = Number(breakdown?.oneWayCharge || 0);
    const oneWayDistanceRate= Number(breakdown?.oneWayDistanceRate || 0);
    const includedKmLimit   = Number(breakdown?.includedKmLimit || 0);

    // Extra km (LOCAL_HOURLY)
    const extraKmCharge     = Number(breakdown?.extraKmCharge || 0);
    const extraKm           = Number(breakdown?.extraKm || 0);
    const extraKmRate       = Number(breakdown?.extraKmRate || 7.5);

    // Extra minutes (LOCAL_HOURLY & ROUND_TRIP)
    const extraMinuteCharge = Number(breakdown?.extraMinuteCharge || 0);
    const extraMinutes      = Number(breakdown?.extraMinutes || 0);
    const extraMinuteRate   = Number(breakdown?.extraMinuteRate || 2.15);
    const includedMinutesLimit = Number(breakdown?.includedMinutesLimit || 0);

    // Extra hours (OUTSTATION)
    const extraHourCharge   = Number(breakdown?.extraHourCharge || 0);
    const extraHours        = Number(breakdown?.extraHours || 0);
    const extraHourRate     = Number(breakdown?.extraHourRate || 0);

    // Extra return km (ROUND_TRIP)
    const extraReturnKmCharge = Number(breakdown?.extraReturnKmCharge || 0);
    const extraReturnKm     = Number(breakdown?.extraReturnKm || 0);

    // Night charge & taxes (added AFTER subtotal)
    const nightCharge       = Number(breakdown?.nightCharge || 0);
    const taxesFee          = Number(breakdown?.taxesFee || 0);

    // Discounts (subtracted from fare.total)
    const promoDiscount      = Number(discounts?.promoDiscount || 0);
    const membershipDiscount = Number(discounts?.membershipDiscount || 0);
    const streakDiscount     = Number(discounts?.streakDiscount || 0);
    const totalDiscount      = Number(booking?.discountAmount || (promoDiscount + membershipDiscount + streakDiscount) || 0);

    // Experienced driver fee (added AFTER discounts)
    const experiencedFee    = Number(booking?.experiencedDriverFee || breakdown?.experiencedDriverFee || 0);

    // Flags
    const hasBaseExtras  = oneWayCharge + extraKmCharge + extraMinuteCharge + extraHourCharge + extraReturnKmCharge > 0;
    const hasNightOrFees = nightCharge + taxesFee > 0;
    const hasDiscounts   = totalDiscount > 0;

    // Always use the server-computed total (source of truth)
    const displayTotal = Number(booking?.totalAmount || 0);

    // ── PDF DOWNLOAD ───────────────────────────────────────────────────────
    const handleDownloadPdf = async () => {
        try {
            setDownloading(true);
            const token = await SecureStore.getItemAsync('accessToken');
            const url = getInvoicePdfUrl(booking.id);
            const fileName = `invoice_${bookingNumber}.pdf`;

            // expo-file-system v19 new API
            const destFile = new File(Paths.cache, fileName);

            await File.downloadFileAsync(url, destFile, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(destFile.uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Invoice ${bookingNumber}`,
                    UTI: 'com.adobe.pdf',
                });
            } else {
                showAlert('Downloaded', `Invoice saved to: ${destFile.uri}`);
            }
        } catch (e: any) {
            showAlert('Error', e?.message || 'Failed to download invoice. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top','bottom']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color={G.accent} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isDriver ? 'Trip Summary' : 'Ride Receipt'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* ── TOTAL CARD ─────────────────────────────────────── */}
                <View style={[styles.totalCard, isDriver && { borderColor: '#10b981', borderWidth: 1.5 }]}>
                    <Icon name={isDriver ? 'wallet' : 'check-circle'} size={40} color="#10b981" />
                    <Text style={styles.totalLabel}>{isDriver ? 'Your Earnings' : 'Total Paid'}</Text>
                    <Text style={styles.totalAmount}>₹{Math.round(isDriver ? driverEarnings : displayTotal)}</Text>
                    <View style={styles.payMethodChip}>
                        <Icon name={payMethodIcon} size={14} color="#6366f1" />
                        <Text style={styles.payMethodText}>
                            {isDriver ? `Customer paid via ${payMethodLabel}` : `Paid via ${payMethodLabel}`}
                        </Text>
                    </View>
                </View>

                {/* ── TRIP INFO ────────────────────────────────────────── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Trip Details</Text>
                    <InfoRow label="Booking #" value={bookingNumber} />
                    <InfoRow label="Trip Type" value={tripTypeLabel} />
                    {distanceKm > 0 && <InfoRow label="Distance" value={`${distanceKm.toFixed(1)} km`} />}
                    {packageHours > 0 && <InfoRow label="Package" value={`${packageHours} hours`} />}
                    {createdAt && <InfoRow label="Booked" value={createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />}
                    {completedAt && <InfoRow label="Completed" value={completedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />}
                </View>

                {/* ── ROUTE ───────────────────────────────────────────── */}
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

                {/* ── FARE BREAKDOWN ──────────────────────────────────── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Fare Breakdown</Text>

                    {/* 1. BASE PACKAGE */}
                    {packagePrice > 0 && (
                        <FareRow
                            icon="car-clock"
                            label={packageHours > 0 ? `Base package (${packageHours} hr)` : 'Base fare'}
                            value={packagePrice}
                        />
                    )}

                    {/* 2. ONE-WAY DISTANCE CHARGE */}
                    {oneWayCharge > 0 && (
                        <FareRow
                            icon="arrow-right-circle-outline"
                            label={includedKmLimit > 0 ? `One-way charge (${includedKmLimit.toFixed(1)} km)` : 'One-way distance charge'}
                            value={oneWayCharge}
                        />
                    )}

                    {/* 3. EXTRA CHARGES */}
                    {(extraKmCharge + extraMinuteCharge + extraHourCharge + extraReturnKmCharge) > 0 && (
                        <>
                            <View style={styles.sectionHeader}>
                                <Icon name="plus-circle-outline" size={13} color={G.warning} />
                                <Text style={[styles.sectionHeaderText, { color: G.warning }]}>Extra Charges</Text>
                            </View>
                            {extraKmCharge > 0 && (
                                <FareRow
                                    icon="road-variant"
                                    label={extraKm > 0 ? `Extra km — ${extraKm.toFixed(1)} km × ₹${extraKmRate}/km` : 'Extra km charges'}
                                    value={extraKmCharge}
                                    highlight="amber"
                                />
                            )}
                            {extraMinuteCharge > 0 && (
                                <FareRow
                                    icon="clock-alert-outline"
                                    label={extraMinutes > 0 ? `Extra time — ${extraMinutes} min × ₹${extraMinuteRate}/min` : 'Extra time charges'}
                                    value={extraMinuteCharge}
                                    highlight="amber"
                                />
                            )}
                            {extraHourCharge > 0 && (
                                <FareRow
                                    icon="clock-fast"
                                    label={extraHours > 0 && extraHourRate > 0 ? `Extra hours — ${extraHours} hr × ₹${extraHourRate}/hr` : `Extra hours (${extraHours} hr)`}
                                    value={extraHourCharge}
                                    highlight="amber"
                                />
                            )}
                            {extraReturnKmCharge > 0 && (
                                <FareRow
                                    icon="map-marker-distance"
                                    label={extraReturnKm > 0 ? `Return distance — ${extraReturnKm.toFixed(1)} km` : 'Return distance charge'}
                                    value={extraReturnKmCharge}
                                    highlight="amber"
                                />
                            )}
                        </>
                    )}

                    {/* 4. NIGHT CHARGE */}
                    {nightCharge > 0 && (
                        <>
                            <View style={styles.fareDivider} />
                            <FareRow icon="weather-night" label="Night charge  (10 PM – 6 AM)" value={nightCharge} highlight="amber" />
                        </>
                    )}

                    {/* 5. EXPERIENCED DRIVER FEE */}
                    {experiencedFee > 0 && (
                        <FareRow icon="account-star" label="Experienced driver fee" value={experiencedFee} />
                    )}

                    {/* 6. TAXES & FEES */}
                    {taxesFee > 0 && (
                        <>
                            <View style={styles.fareDivider} />
                            <FareRow icon="receipt-text-outline" label="Taxes & convenience fee" value={taxesFee} />
                        </>
                    )}

                    {/* 7. DISCOUNTS */}
                    {hasDiscounts && (
                        <>
                            <View style={[styles.sectionHeader, { marginTop: 4 }]}>
                                <Icon name="tag-multiple-outline" size={13} color="#10b981" />
                                <Text style={[styles.sectionHeaderText, { color: '#10b981' }]}>Discounts Applied 🎉</Text>
                            </View>
                            {promoDiscount > 0 && (
                                <FareRow icon="ticket-percent-outline" label="Promo / coupon discount" value={promoDiscount} isDiscount />
                            )}
                            {membershipDiscount > 0 && (
                                <FareRow
                                    icon="crown-outline"
                                    label={`${discounts?.membershipType || 'Membership'} plan discount`}
                                    value={membershipDiscount}
                                    isDiscount
                                />
                            )}
                            {streakDiscount > 0 && (
                                <FareRow
                                    icon="fire"
                                    label={discounts?.streakRides ? `Streak discount (${discounts.streakRides} rides${discounts.streakPct ? `, ${discounts.streakPct}% off` : ''})` : 'Streak discount'}
                                    value={streakDiscount}
                                    isDiscount
                                />
                            )}
                        </>
                    )}

                    {/* 8. TOTAL PAYABLE */}
                    <View style={styles.totalPayableRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.totalPayableLabel}>Total Payable</Text>
                            {hasDiscounts && (
                                <Text style={styles.savedText}>You saved ₹{Math.round(totalDiscount)} 🎉</Text>
                            )}
                        </View>
                        <Text style={styles.totalPayableValue}>₹{Math.round(displayTotal)}</Text>
                    </View>

                    {/* TIP (outside total) */}
                    {Number(booking?.tipAmount || 0) > 0 && (
                        <View style={[styles.fareRow, styles.tipRow]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <Icon name="hand-heart" size={16} color={G.accent} />
                                <Text style={[styles.fareLabel, { color: G.accent }]}>Driver tip (not included above)</Text>
                            </View>
                            <Text style={[styles.fareValue, { color: G.accent }]}>+₹{Math.round(Number(booking?.tipAmount || 0))}</Text>
                        </View>
                    )}
                </View>

                {/* ── DRIVER EARNINGS BREAKDOWN ───────────────────── */}
                {isDriver && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Your Earnings</Text>
                        <FareRow icon="cash-multiple" label="Total ride fare" value={displayTotal} />
                        {commission > 0 && (
                            <FareRow icon="percent" label="Platform commission" value={commission} isDeduction />
                        )}
                        <View style={styles.fareDivider} />
                        <View style={styles.fareRow}>
                            <Text style={styles.fareTotalLabel}>Your earnings</Text>
                            <Text style={[styles.fareTotalValue, { color: '#10b981' }]}>₹{Math.round(driverEarnings)}</Text>
                        </View>
                        {commission === 0 && (
                            <View style={[styles.fareRow, { backgroundColor: G.glass2, borderRadius: 8, paddingHorizontal: 8, marginTop: 4 }]}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>0% platform fee — you keep everything!</Text>
                            </View>
                        )}
                        {paymentMethod === 'CASH' && (
                            <View style={[styles.fareRow, { backgroundColor: '#1A170A', borderRadius: 8, paddingHorizontal: 8, marginTop: 4 }]}>
                                <Icon name="cash" size={14} color="#f59e0b" />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#f59e0b', marginLeft: 6 }}>Cash collected — not added to wallet</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ── DOWNLOAD PDF ─────────────────────────────────── */}
                {booking?.status === 'COMPLETED' && booking?.id && (
                    <TouchableOpacity
                        style={[styles.downloadBtn, downloading && { opacity: 0.6 }]}
                        disabled={downloading}
                        onPress={handleDownloadPdf}
                    >
                        {downloading ? (
                            <ActivityIndicator size="small" color={G.accent} />
                        ) : (
                            <Icon name="file-pdf-box" size={22} color={G.accent} />
                        )}
                        <Text style={styles.downloadBtnText}>
                            {downloading ? 'Downloading…' : 'Download Invoice PDF'}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

// ── Small helper components ─────────────────────────────────────────────────

const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

const FareRow = ({
    icon,
    label,
    value,
    isDiscount = false,
    isDeduction = false,
    highlight,
}: {
    icon: string;
    label: string;
    value: number;
    isDiscount?: boolean;
    isDeduction?: boolean;
    highlight?: 'amber';
}) => {
    const valueColor = isDiscount ? '#10b981' : isDeduction ? '#ef4444' : highlight === 'amber' ? '#f59e0b' : G.textPrimary;
    const prefix = isDiscount ? '−₹' : isDeduction ? '−₹' : '₹';

    return (
        <View style={styles.fareRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Icon
                    name={icon as any}
                    size={16}
                    color={isDiscount ? '#10b981' : highlight === 'amber' ? '#f59e0b' : '#8A8A8A'}
                />
                <Text style={[styles.fareLabel, highlight === 'amber' && { color: '#f59e0b' }]}>{label}</Text>
            </View>
            <Text style={[styles.fareValue, { color: valueColor }]}>{prefix}{Math.round(value)}</Text>
        </View>
    );
};

// ── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: G.bg },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: G.glass1,
        borderBottomWidth: 1, borderBottomColor: G.border2,
    },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
    content: { padding: 16, paddingBottom: 40 },

    totalCard: {
        backgroundColor: G.glass2, borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 14,
        borderWidth: 1, borderColor: G.border2,
    },
    totalLabel: { fontSize: 13, fontWeight: '700', color: G.textSecondary, marginTop: 8 },
    totalAmount: { fontSize: 38, fontWeight: '900', color: G.textPrimary, marginTop: 4 },
    payMethodChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
        backgroundColor: 'rgba(99,102,241,0.12)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    },
    payMethodText: { fontSize: 12, fontWeight: '700', color: '#818cf8' },

    card: {
        backgroundColor: G.glass1, borderRadius: 16, padding: 16, marginBottom: 14,
        borderWidth: 1, borderColor: G.border2,
    },
    cardTitle: { fontSize: 14, fontWeight: '800', color: G.textPrimary, marginBottom: 12 },

    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    infoLabel: { fontSize: 13, color: G.textSecondary, fontWeight: '600' },
    infoValue: { fontSize: 13, color: G.textPrimary, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 8 },

    routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginTop: 4 },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginTop: 4 },
    routeLine: { width: 2, height: 14, backgroundColor: G.border2, marginLeft: 4, marginVertical: 2 },
    routeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#CCCCCC' },

    fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
    fareLabel: { fontSize: 13, color: G.textSecondary, fontWeight: '600' },
    fareValue: { fontSize: 13, color: G.textPrimary, fontWeight: '700' },
    fareDivider: { height: 1, backgroundColor: G.border2, marginVertical: 8 },
    fareTotalLabel: { fontSize: 15, fontWeight: '900', color: G.textPrimary },
    fareTotalValue: { fontSize: 18, fontWeight: '900', color: G.textPrimary },

    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 10, marginBottom: 4,
        paddingVertical: 5, paddingHorizontal: 8,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
    },
    sectionHeaderText: {
        fontSize: 11, fontWeight: '800', color: G.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.5,
    },

    totalPayableRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 10, paddingTop: 12, paddingHorizontal: 12,
        borderTopWidth: 2, borderTopColor: G.accent,
        backgroundColor: 'rgba(201,168,76,0.07)', borderRadius: 10, paddingBottom: 12,
    },
    totalPayableLabel: { fontSize: 16, fontWeight: '900', color: G.textPrimary },
    totalPayableValue: { fontSize: 22, fontWeight: '900', color: G.accent },
    savedText: { fontSize: 11, fontWeight: '700', color: '#10b981', marginTop: 2 },

    tipRow: {
        backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: 8,
        paddingHorizontal: 8, marginTop: 6,
    },

    downloadBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: G.glass2, borderRadius: 14, padding: 16, marginTop: 4,
        borderWidth: 1, borderColor: G.accent + '44',
    },
    downloadBtnText: { fontSize: 14, fontWeight: '800', color: G.accent },
});

export default RideReceiptScreen;
