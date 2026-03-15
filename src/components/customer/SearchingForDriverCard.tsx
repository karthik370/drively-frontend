import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface Props {
    pickupAddress?: string;
    dropAddress?: string;
    fare?: number;
    vehicleType?: string;
    onCancel?: () => void;
}

const SearchingForDriverCard = ({ pickupAddress, dropAddress, fare, vehicleType, onCancel }: Props) => {
    // Radar pulse animations
    const pulse1 = useRef(new Animated.Value(0)).current;
    const pulse2 = useRef(new Animated.Value(0)).current;
    const pulse3 = useRef(new Animated.Value(0)).current;
    const dotSpin = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createPulse = (anim: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.parallel([
                        Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    ]),
                    Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
                ])
            );

        const spin = Animated.loop(
            Animated.timing(dotSpin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
        );

        const p1 = createPulse(pulse1, 0);
        const p2 = createPulse(pulse2, 600);
        const p3 = createPulse(pulse3, 1200);

        p1.start();
        p2.start();
        p3.start();
        spin.start();

        return () => { p1.stop(); p2.stop(); p3.stop(); spin.stop(); };
    }, [pulse1, pulse2, pulse3, dotSpin]);

    const renderPulse = (anim: Animated.Value) => (
        <Animated.View
            style={[
                styles.pulseRing,
                {
                    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] }),
                    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
                },
            ]}
        />
    );

    const spinRotate = dotSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <View style={styles.container}>
            {/* Radar animation */}
            <View style={styles.radarWrap}>
                {renderPulse(pulse1)}
                {renderPulse(pulse2)}
                {renderPulse(pulse3)}
                <View style={styles.radarCenter}>
                    <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                        <Icon name="car-connected" size={28} color="#ffffff" />
                    </Animated.View>
                </View>
            </View>

            <Text style={styles.title}>Finding your driver</Text>
            <Text style={styles.subtitle}>Connecting you with the nearest available driver...</Text>

            {/* Route summary */}
            <View style={styles.routeCard}>
                <View style={styles.routeRow}>
                    <View style={styles.routeDotGreen} />
                    <Text style={styles.routeText} numberOfLines={1}>
                        {pickupAddress || 'Pickup location'}
                    </Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeRow}>
                    <View style={styles.routeDotRed} />
                    <Text style={styles.routeText} numberOfLines={1}>
                        {dropAddress || 'Drop location'}
                    </Text>
                </View>
            </View>

            {/* Ride info pills */}
            <View style={styles.pillsRow}>
                {fare ? (
                    <View style={styles.pill}>
                        <Icon name="currency-inr" size={14} color="#10b981" />
                        <Text style={styles.pillText}>₹{Math.round(fare)}</Text>
                    </View>
                ) : null}
                {vehicleType ? (
                    <View style={styles.pill}>
                        <Icon name="car" size={14} color="#6366f1" />
                        <Text style={styles.pillText}>{vehicleType}</Text>
                    </View>
                ) : null}
                <View style={styles.pill}>
                    <Icon name="shield-check" size={14} color="#C9A84C" />
                    <Text style={styles.pillText}>Verified drivers</Text>
                </View>
            </View>

            {/* Safety tip */}
            <View style={styles.safetyRow}>
                <Icon name="information" size={16} color="#9ca3af" />
                <Text style={styles.safetyText}>
                    Share your ride OTP only with your assigned driver
                </Text>
            </View>

            {/* Cancel */}
            {onCancel ? (
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
                    <Icon name="close" size={16} color="#ef4444" />
                    <Text style={styles.cancelText}>Cancel booking</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#0A0A0A',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 16,
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
    },

    // Radar
    radarWrap: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    pulseRing: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#C9A84C',
    },
    radarCenter: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#C9A84C',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowcolor: '#C9A84C',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },

    title: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#8A8A8A',
        marginBottom: 16,
        textAlign: 'center',
    },

    // Route card
    routeCard: {
        width: '100%',
        backgroundColor: '#111111',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    routeDotGreen: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10b981',
    },
    routeDotRed: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },
    routeLine: {
        width: 2,
        height: 16,
        backgroundColor: '#1E1E1E',
        marginLeft: 4,
        marginVertical: 2,
    },
    routeText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#CCCCCC',
    },

    // Pills
    pillsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
        justifyContent: 'center',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#141414',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#CCCCCC',
    },

    // Safety
    safetyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 14,
    },
    safetyText: {
        fontSize: 11,
        color: '#666666',
    },

    // Cancel
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#fee2e2',
        backgroundColor: 'rgba(255,68,68,0.08)',
    },
    cancelText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#ef4444',
    },
});

export default SearchingForDriverCard;
