/**
 * LoadingSkeleton — Shimmer loading placeholder
 * ──────────────────────────────────────────────
 * Shows animated shimmer bars while content loads.
 * Prevents jarring blank-to-content transitions.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { G } from '../../constants/glassStyles';

const SHIMMER_DURATION = 1200;

const ShimmerBar = ({
    width = '100%',
    height = 14,
    borderRadius = 8,
    style,
}: {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
}) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.7, duration: SHIMMER_DURATION / 2, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: SHIMMER_DURATION / 2, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: G.glass3,
                    opacity,
                },
                style,
            ]}
        />
    );
};

/** Full-screen loading skeleton with multiple bars */
export const ScreenSkeleton = ({ lines = 6 }: { lines?: number }) => (
    <View style={styles.container}>
        <ShimmerBar width="60%" height={20} style={{ marginBottom: 20 }} />
        {Array.from({ length: lines }).map((_, i) => (
            <View key={i} style={styles.row}>
                <ShimmerBar width={40} height={40} borderRadius={12} />
                <View style={styles.textCol}>
                    <ShimmerBar width="80%" height={12} />
                    <ShimmerBar width="50%" height={10} style={{ marginTop: 6 }} />
                </View>
            </View>
        ))}
    </View>
);

/** Card-shaped loading skeleton */
export const CardSkeleton = () => (
    <View style={styles.card}>
        <ShimmerBar width="40%" height={16} />
        <ShimmerBar width="100%" height={12} style={{ marginTop: 12 }} />
        <ShimmerBar width="70%" height={12} style={{ marginTop: 6 }} />
        <View style={[styles.row, { marginTop: 12 }]}>
            <ShimmerBar width="30%" height={32} borderRadius={10} />
            <ShimmerBar width="30%" height={32} borderRadius={10} />
            <ShimmerBar width="30%" height={32} borderRadius={10} />
        </View>
    </View>
);

/** Map area skeleton */
export const MapSkeleton = () => (
    <View style={styles.mapPlaceholder}>
        <ShimmerBar width="100%" height={200} borderRadius={0} />
    </View>
);

/**
 * BookingCardSkeleton — matches the exact shape of a booking history card.
 * Show 3-4 of these while getBookingHistory() is in-flight.
 */
export const BookingCardSkeleton = () => (
    <View style={styles.card}>
        {/* Header row: booking number + status badge */}
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
            <View>
                <ShimmerBar width={120} height={14} />
                <ShimmerBar width={80} height={10} style={{ marginTop: 6 }} />
            </View>
            <ShimmerBar width={70} height={24} borderRadius={12} />
        </View>
        {/* Route: pickup → drop */}
        <ShimmerBar width="90%" height={11} style={{ marginBottom: 8 }} />
        <ShimmerBar width={12} height={16} borderRadius={2} style={{ marginLeft: 5, marginBottom: 8 }} />
        <ShimmerBar width="80%" height={11} style={{ marginBottom: 14 }} />
        {/* Footer: driver name + amount */}
        <View style={[styles.row, { justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }]}>
            <ShimmerBar width={100} height={12} />
            <ShimmerBar width={50} height={18} />
        </View>
    </View>
);

/**
 * EarningsSkeleton — matches the DriverEarningsScreen layout.
 * Shows while earnings data is loading.
 */
export const EarningsSkeleton = () => (
    <View style={styles.container}>
        {/* Total earnings card */}
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 32, marginBottom: 12 }]}>
            <ShimmerBar width={100} height={12} style={{ marginBottom: 12 }} />
            <ShimmerBar width={160} height={44} borderRadius={8} style={{ marginBottom: 10 }} />
            <ShimmerBar width={60} height={10} />
        </View>
        {/* Today card */}
        <View style={[styles.card, { marginBottom: 12 }]}>
            <ShimmerBar width={140} height={14} style={{ marginBottom: 14 }} />
            <ShimmerBar width={120} height={30} borderRadius={8} style={{ alignSelf: 'center' }} />
        </View>
        {/* Goal card */}
        <View style={[styles.card, { marginBottom: 12 }]}>
            <ShimmerBar width="60%" height={12} style={{ marginBottom: 10 }} />
            <ShimmerBar width="100%" height={8} borderRadius={4} style={{ marginBottom: 6 }} />
            <ShimmerBar width="40%" height={10} />
        </View>
        {/* Previous earnings rows */}
        <View style={styles.card}>
            <ShimmerBar width={130} height={14} style={{ marginBottom: 16 }} />
            {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.row, { justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
                    <ShimmerBar width={90} height={12} />
                    <ShimmerBar width={50} height={14} />
                </View>
            ))}
        </View>
    </View>
);

export { ShimmerBar };


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: G.bg,
        padding: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    textCol: {
        flex: 1,
    },
    card: {
        backgroundColor: G.glass1,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: G.border3,
        marginBottom: 12,
    },
    mapPlaceholder: {
        height: 200,
        backgroundColor: G.glass2,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
    },
});
