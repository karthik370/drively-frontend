import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { createDriverSubscriptionOrder, verifyDriverSubscriptionPayment } from '../../services/api';
import { openCashfreeCheckout } from '../../services/cashfreeService';
import { useAppSelector } from '../../redux/store';
import { showAlert } from '../common/CustomAlert';
import { G } from '../../constants/glassStyles';

interface SubscriptionGateProps {
    onSuccess: () => void;
    price?: number;
    originalPrice?: number;
}

const SubscriptionGate: React.FC<SubscriptionGateProps> = ({
    onSuccess,
    price = 50,
    originalPrice = 500,
}) => {
    const [loading, setLoading] = useState(false);
    const insets = useSafeAreaInsets();

    // Pulse animation for the offer badge
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const priceScale = useRef(new Animated.Value(0.85)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        ).start();

        Animated.spring(priceScale, {
            toValue: 1,
            tension: 55,
            friction: 8,
            useNativeDriver: true,
        }).start();
    }, []);

    const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);

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
        // flex:1 fills exactly the space between header and tab bar (SafeAreaView handles insets)
        <View style={styles.container}>
            {/* ScrollView ensures content never overflows on very small phones */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* ── Offer Badge ── */}
                <Animated.View style={[styles.offerBanner, { transform: [{ scale: pulseAnim }] }]}>
                    <Icon name="lightning-bolt" size={12} color="#fff" />
                    <Text style={styles.offerBannerText}>🎉 LAUNCH OFFER — {discountPercent}% OFF</Text>
                    <Icon name="lightning-bolt" size={12} color="#fff" />
                </Animated.View>

                {/* ── Crown ── */}
                <View style={styles.iconContainer}>
                    <Icon name="crown" size={38} color="#f59e0b" />
                </View>

                {/* ── Title ── */}
                <Text style={styles.title}>Unlock Unlimited Bookings</Text>
                <Text style={styles.subtitle}>
                    One-time fee to start earning.{' '}
                </Text>

                {/* ── Price Block ── */}
                <Animated.View style={[styles.priceBox, { transform: [{ scale: priceScale }] }]}>
                    {/* Old price — struck out */}
                    <View style={styles.oldPriceRow}>
                        <Text style={styles.oldPrice}>₹{originalPrice}</Text>
                        <View style={styles.strikeThrough} />
                        <View style={styles.regularTag}>
                            <Text style={styles.regularTagText}>Regular</Text>
                        </View>
                    </View>

                    <View style={styles.priceDivider} />

                    {/* New price */}
                    <View style={styles.newPriceRow}>
                        <Text style={styles.newPriceCurrency}>₹</Text>
                        <Text style={styles.newPriceValue}>{price}</Text>
                        <View style={styles.savingsTag}>
                            <Text style={styles.savingsTagText}>Save ₹{originalPrice - price}</Text>
                        </View>
                    </View>
                    <Text style={styles.youPayLabel}>You Pay Today</Text>
                </Animated.View>

                {/* ── Benefits ── */}
                <View style={styles.benefitsContainer}>
                    {[
                        { icon: 'percent', text: '0% Platform Commission', color: '#10b981' },
                        { icon: 'car-multiple', text: 'Unlimited ride requests', color: '#10b981' },
                        { icon: 'shield-check', text: 'One-time fee, never recurring', color: '#f59e0b' },
                    ].map((b) => (
                        <View key={b.text} style={styles.benefitRow}>
                            <View style={[styles.benefitIconBox, { backgroundColor: b.color + '22' }]}>
                                <Icon name={b.icon as any} size={14} color={b.color} />
                            </View>
                            <Text style={styles.benefitText}>{b.text}</Text>
                        </View>
                    ))}
                </View>

                {/* ── Urgency ── */}
                <View style={styles.urgencyRow}>
                    <Icon name="clock-alert-outline" size={12} color="#f59e0b" />
                    <Text style={styles.urgencyText}>Limited time — prices go up soon!</Text>
                </View>

                {/* ── CTA ── */}
                <TouchableOpacity
                    style={[styles.payButton, loading && { opacity: 0.55 }]}
                    onPress={handleSubscribe}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color="#1a1a1a" />
                    ) : (
                        <View style={styles.payButtonInner}>
                            <View>
                                <Text style={styles.payButtonTop}>Pay Just ₹{price} Today</Text>
                                <Text style={styles.payButtonSub}>
                                    <Text style={styles.payButtonStrike}>₹{originalPrice}</Text>
                                    {'  '}Save ₹{originalPrice - price}
                                </Text>
                            </View>
                            <View style={styles.payButtonArrow}>
                                <Icon name="arrow-right" size={18} color="#1a1a1a" />
                            </View>
                        </View>
                    )}
                </TouchableOpacity>

                <Text style={styles.secureText}>🔒 Secure payment by Cashfree</Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    // ── Outer container — fills space between header and tab bar ──
    container: {
        flex: 1,
        backgroundColor: G.bgAlt,
    },

    // Scroll content: center vertically, pad sides, never overflow
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },

    // ── Offer Badge ──
    offerBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#dc2626',
        borderRadius: 30,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginBottom: 12,
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
        elevation: 5,
    },
    offerBannerText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.4,
    },

    // ── Crown ──
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(245,158,11,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fde68a',
        marginBottom: 10,
    },

    // ── Title / Subtitle ──
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: G.textPrimary,
        textAlign: 'center',
        marginBottom: 5,
        letterSpacing: 0.2,
    },
    subtitle: {
        fontSize: 12.5,
        color: G.textMuted,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 14,
    },

    // ── Price Box ──
    priceBox: {
        width: '100%',
        backgroundColor: G.glass2,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: G.accent + '50',
        paddingHorizontal: 18,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 14,
        gap: 4,
    },

    // Old (struck-through) price
    oldPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
    },
    oldPrice: {
        fontSize: 26,
        fontWeight: '900',
        color: G.textSecondary,
        opacity: 0.5,
        letterSpacing: -1,
    },
    strikeThrough: {
        position: 'absolute',
        left: 0,
        right: 50,    // stop before the tag
        top: '50%',
        height: 2.5,
        backgroundColor: '#ef4444',
        borderRadius: 2,
        transform: [{ translateY: -1 }],
    },
    regularTag: {
        backgroundColor: '#ef444422',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    regularTagText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: '700',
    },

    priceDivider: {
        width: '70%',
        height: 1,
        backgroundColor: G.border3,
        marginVertical: 8,
    },

    // New price
    newPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    newPriceCurrency: {
        fontSize: 20,
        fontWeight: '700',
        color: G.accent,
    },
    newPriceValue: {
        fontSize: 48,
        fontWeight: '900',
        color: G.accent,
        letterSpacing: -2,
        lineHeight: 54,
    },
    savingsTag: {
        backgroundColor: '#10b981',
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    savingsTagText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    youPayLabel: {
        fontSize: 11,
        color: '#10b981',
        fontWeight: '700',
        marginTop: 2,
        letterSpacing: 0.3,
    },

    // ── Benefits ──
    benefitsContainer: {
        width: '100%',
        gap: 7,
        marginBottom: 12,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    benefitIconBox: {
        width: 28,
        height: 28,
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    benefitText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: G.textPrimary,
        flex: 1,
    },

    // ── Urgency ──
    urgencyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 12,
    },
    urgencyText: {
        fontSize: 11,
        color: '#f59e0b',
        fontWeight: '700',
    },

    // ── CTA Button ──
    payButton: {
        width: '100%',
        backgroundColor: G.accent,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 14,
        shadowColor: G.accent,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 10,
    },
    payButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    payButtonTop: {
        fontSize: 15,
        fontWeight: '900',
        color: '#1a1a1a',
        letterSpacing: 0.1,
    },
    payButtonSub: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1a1a1a',
        opacity: 0.7,
        marginTop: 1,
    },
    payButtonStrike: {
        textDecorationLine: 'line-through',
    },
    payButtonArrow: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Secure ──
    secureText: {
        fontSize: 11,
        color: G.textMuted,
        textAlign: 'center',
    },
});

export default SubscriptionGate;
