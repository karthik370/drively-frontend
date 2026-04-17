import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
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

    const handleSubscribe = async () => {
        try {
            setLoading(true);

            // Step 1: Create Order on Backend (server-to-server with Cashfree)
            const orderData = await createDriverSubscriptionOrder('UPI');

            if (!orderData || !orderData.orderId) {
                throw new Error('Failed to create subscription order');
            }

            // Step 2: Open Cashfree Checkout (native SDK overlay)
            const success = await openCashfreeCheckout({
                orderId: String(orderData.orderId),
                paymentSessionId: String(orderData.paymentSessionId),
            });

            // Step 3: Verify payment on backend
            await verifyDriverSubscriptionPayment(success.orderId);

            showAlert('Success', 'Subscription activated successfully!', [
                { text: 'OK', onPress: onSuccess }
            ]);
        } catch (e: any) {
            showAlert('Subscription Error', e.message || 'Could not complete payment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.iconContainer}>
                    <Icon name="crown" size={48} color="#f59e0b" />
                </View>

                <Text style={styles.title}>Unlock Unlimited Bookings</Text>
                <Text style={styles.subtitle}>
                    Subscribe to start receiving ride requests. You keep 100% of every fare!
                </Text>

                <View style={styles.priceContainer}>
                    <Text style={styles.currency}>₹</Text>
                    <Text style={styles.price}>{price}</Text>
                    <Text style={styles.period}>/ month</Text>
                </View>

                <View style={styles.benefitsContainer}>
                    <View style={styles.benefitRow}>
                        <Icon name="check-circle" size={20} color="#10b981" />
                        <Text style={styles.benefitText}>0% Platform Commission</Text>
                    </View>
                    <View style={styles.benefitRow}>
                        <Icon name="check-circle" size={20} color="#10b981" />
                        <Text style={styles.benefitText}>Keep 100% of cash & online fares</Text>
                    </View>
                    <View style={styles.benefitRow}>
                        <Icon name="check-circle" size={20} color="#10b981" />
                        <Text style={styles.benefitText}>Unlimited ride requests</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.payButton, loading && styles.payButtonDisabled]}
                    onPress={handleSubscribe}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <Text style={styles.payButtonText}>Pay ₹{price} Securely</Text>
                            <Icon name="arrow-right" size={20} color="#ffffff" />
                        </>
                    )}
                </TouchableOpacity>

                <Text style={styles.secureText}>
                    <Icon name="lock" size={12} color="#8A8A8A" /> Secure payment by Cashfree
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
        padding: 20,
        backgroundColor: G.bgAlt,
    },
    card: {
        width: '100%',
        backgroundColor: G.bg,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: G.border3,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: G.glass2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 4,
        borderColor: '#fde68a',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: G.textPrimary,
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#8A8A8A',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
        paddingHorizontal: 10,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 24,
        backgroundColor: G.glass2,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 16,
    },
    currency: {
        fontSize: 24,
        fontWeight: '700',
        color: G.textPrimary,
        marginRight: 4,
    },
    price: {
        fontSize: 48,
        fontWeight: '900',
        color: G.textPrimary,
        letterSpacing: -1,
    },
    period: {
        fontSize: 16,
        fontWeight: '600',
        color: '#8A8A8A',
        marginLeft: 8,
    },
    benefitsContainer: {
        width: '100%',
        marginBottom: 32,
        gap: 12,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    benefitText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#CCCCCC',
    },
    payButton: {
        width: '100%',
        backgroundColor: G.glass3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    payButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    payButtonText: {
        color: G.textPrimary,
        fontSize: 16,
        fontWeight: '800',
    },
    secureText: {
        marginTop: 16,
        fontSize: 12,
        color: '#8A8A8A',
        textAlign: 'center',
    }
});

export default SubscriptionGate;
