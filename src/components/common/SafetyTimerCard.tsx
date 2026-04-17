import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

interface Props {
    isActive: boolean;
    currentLocation?: { latitude: number; longitude: number } | null;
    expectedRoute?: { latitude: number; longitude: number }[];
    deviationThresholdKm?: number;
}

const toRad = (deg: number) => deg * (Math.PI / 180);

const haversineKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const minDistToRoute = (point: { latitude: number; longitude: number }, route: { latitude: number; longitude: number }[]) => {
    if (!route.length) return Infinity;
    let min = Infinity;
    for (const rp of route) {
        const d = haversineKm(point, rp);
        if (d < min) min = d;
    }
    return min;
};

const SafetyTimerCard = ({ isActive, currentLocation, expectedRoute, deviationThresholdKm = 0.5 }: Props) => {
    const [isDeviated, setIsDeviated] = useState(false);
    const [deviationKm, setDeviationKm] = useState(0);
    const [tripMinutes, setTripMinutes] = useState(0);
    const pulseAnim = useRef(new Animated.Value(0)).current;

    // Track trip time
    useEffect(() => {
        if (!isActive) { setTripMinutes(0); return; }
        const interval = setInterval(() => setTripMinutes((m) => m + 1), 60000);
        return () => clearInterval(interval);
    }, [isActive]);

    // Check for route deviation
    useEffect(() => {
        if (!isActive || !currentLocation || !expectedRoute?.length) {
            setIsDeviated(false);
            return;
        }
        const dist = minDistToRoute(currentLocation, expectedRoute);
        setDeviationKm(dist);
        setIsDeviated(dist > deviationThresholdKm);
    }, [isActive, currentLocation, expectedRoute, deviationThresholdKm]);

    // Pulse animation when deviated
    useEffect(() => {
        if (!isDeviated) { pulseAnim.setValue(0); return; }
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [isDeviated, pulseAnim]);

    if (!isActive) return null;

    return (
        <Animated.View style={[
            styles.container,
            isDeviated && styles.containerDeviated,
            isDeviated && { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
        ]}>
            <View style={styles.row}>
                <View style={[styles.iconWrap, isDeviated ? styles.iconWrapDeviated : null]}>
                    <Icon
                        name={isDeviated ? 'alert' : 'shield-check'}
                        size={18}
                        color={isDeviated ? '#ef4444' : '#10b981'}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, isDeviated && { color: '#ef4444' }]}>
                        {isDeviated ? '⚠️ Route Deviation Detected' : 'On Route'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {isDeviated
                            ? `Driver is ${deviationKm.toFixed(1)}km off the expected route`
                            : `Trip time: ${tripMinutes} min • On expected route`
                        }
                    </Text>
                </View>
                {isDeviated ? (
                    <View style={styles.alertBadge}>
                        <Text style={styles.alertText}>Alert</Text>
                    </View>
                ) : null}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: G.glass2,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#bbf7d0',
        marginBottom: 10,
    },
    containerDeviated: {
        backgroundColor: '#1A0F0F',
        borderColor: '#fecaca',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: G.glass2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapDeviated: {
        backgroundColor: '#1A1010',
    },
    title: { fontSize: 13, fontWeight: '800', color: '#065f46' },
    subtitle: { fontSize: 11, color: '#8A8A8A', fontWeight: '600', marginTop: 1 },
    alertBadge: {
        backgroundColor: '#ef4444',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    alertText: { fontSize: 10, fontWeight: '800', color: G.textPrimary },
});

export default SafetyTimerCard;
