import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { createDriverSubscriptionOrder, verifyDriverSubscriptionPayment } from '../../services/api';
import { openCashfreeCheckout } from '../../services/cashfreeService';
import { useAppSelector } from '../../redux/store';
import { showAlert } from '../common/CustomAlert';
import { G } from '../../constants/glassStyles';

interface SubscriptionGateProps {
    onSuccess: () => void;
    price?: number;
}

const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ onSuccess, price = 500 }) => {
    const [loading, setLoading] = useState(false);
    const user = useAppSelector((s) => s.auth.user);
    const { width, height } = useWindowDimensions();

    // Responsive scale — cap on tablets / large phones
    const isSmall = height < 680;         // very small screen (e.g. Galaxy A series)
    const iconSize   = isSmall ? 40 : 48;
    const iconBox    = isSmall ? 64 : 76;
    const titleSize  = isSmall ? 18 : 20;
    const priceSize  = isSmall ? 36 : 42;
    const currSize   = isSmall ? 20 : 22;
    const bodySize   = isSmall ? 13 : 14;
    const benefitSize = isSmall ? 13 : 14;
    const cardPad    = isSmall ? 18 : 22;
    const vGap       = isSmall ? 14 : 20;

    const handleSubscribe = async () => {
        try {
            setLoading(true);

            const orderData = await createDriverSubscriptionOrder('UPI');
            if (!orderData || !orderData.orderId) {
                throw new Error('Failed to create subscription order');
            }

            const success = await openCashfreeCheckout({
                orderId: String(orderData.orderId),
                paymentSessionId: String(orderData.paymentSessionId),
            });

            await verifyDriverSubscriptionPayment(success.orderId);

            showAlert('Success', 'Subscription activated successfully!', [
                { text: 'OK', onPress: onSuccess },
            ]);
        } catch (e: any) {
            showAlert('Subscription Error', e.message || 'Could not complete payment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.card, { padding: cardPad, maxWidth: Math.min(width - 32, 420) }]}>

                {/* Crown icon */}
                <View style={[
                    styles.iconContainer,
                    { width: iconBox, height: iconBox, borderRadius: iconBox / 2, marginBottom: vGap },
                ]}>
                    <Icon name="crown" size={iconSize} color="#f59e0b" />
                </View>

                {/* Title */}
                <Text style={[styles.title, { fontSize: titleSize, marginBottom: 6 }]}>
                    Unlock Unlimited Bookings
                </Text>

                {/* Subtitle */}
                <Text style={[styles.subtitle, { fontSize: bodySize, marginBottom: vGap }]}>
                    Subscribe to start receiving ride requests.{'\n'}You keep 100% of every fare!
                </Text>

                {/* Price pill */}
                <View style={[styles.priceContainer, { marginBottom: vGap }]}>
                    <Text style={[styles.currency, { fontSize: currSize }]}>₹</Text>
                    <Text style={[styles.price, { fontSize: priceSize }]}>{price}</Text>
                    <Text style={styles.period}>/ month</Text>
                </View>

                {/* Benefits */}
                <View style={[styles.benefitsContainer, { marginBottom: vGap }]}>
                    {[
                        '0% Platform Commission',
                        'Keep 100% of cash & online fares',
                        'Unlimited ride requests',
                    ].map((benefit) => (
                        <View key={benefit} style={styles.benefitRow}>
                            <Icon name="check-circle" size={benefitSize + 4} color="#10b981" />
                            <Text style={[styles.benefitText, { fontSize: benefitSize }]}>{benefit}</Text>
                        </View>
                    ))}
                </View>

                {/* Pay button */}
                <TouchableOpacity
                    style={[styles.payButton, loading && styles.payButtonDisabled]}
                    onPress={handleSubscribe}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <Text style={styles.payButtonText}>Pay ₹{price} Securely</Text>
                            <Icon name="arrow-right" size={18} color="#ffffff" />
                        </>
                    )}
                </TouchableOpacity>

                {/* Secure note */}
                <Text style={styles.secureText}>
                    🔒  Secure payment by Cashfree
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: G.bgAlt,
    },
    card: {
        width: '100%',
        backgroundColor: G.bg,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 10,
        borderWidth: 1,
        borderColor: G.border3,
    },
    iconContainer: {
        backgroundColor: G.glass2,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fde68a',
    },
    title: {
        fontWeight: '800',
        color: G.textPrimary,
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        color: G.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        backgroundColor: G.glass2,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 14,
    },
    currency: {
        fontWeight: '700',
        color: G.textPrimary,
        marginRight: 3,
    },
    price: {
        fontWeight: '900',
        color: G.textPrimary,
        letterSpacing: -1,
    },
    period: {
        fontSize: 14,
        fontWeight: '600',
        color: G.textMuted,
        marginLeft: 6,
    },
    benefitsContainer: {
        width: '100%',
        gap: 10,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    benefitText: {
        fontWeight: '600',
        color: '#CCCCCC',
        flex: 1,
    },
    payButton: {
        width: '100%',
        backgroundColor: G.glass3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    payButtonDisabled: {
        opacity: 0.5,
    },
    payButtonText: {
        color: G.textPrimary,
        fontSize: 15,
        fontWeight: '800',
    },
    secureText: {
        marginTop: 14,
        fontSize: 12,
        color: G.textMuted,
        textAlign: 'center',
    },
});

export default SubscriptionGate;
