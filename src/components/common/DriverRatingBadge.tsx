import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

interface Props {
    rating: number | null | undefined;
    totalRides?: number | null;
    size?: 'small' | 'large';
}

const DriverRatingBadge = ({ rating, totalRides, size = 'small' }: Props) => {
    const numRating = typeof rating === 'number' && rating > 0 ? rating : null;
    const isLarge = size === 'large';

    if (!numRating) {
        return (
            <View style={[styles.badge, isLarge && styles.badgeLarge, { backgroundColor: G.glass2 }]}>
                <Icon name="star-outline" size={isLarge ? 16 : 12} color="#9ca3af" />
                <Text style={[styles.text, isLarge && styles.textLarge, { color: '#666666' }]}>New</Text>
            </View>
        );
    }

    // Color based on rating
    const color = numRating >= 4.5 ? '#16a34a' :
        numRating >= 4.0 ? '#10b981' :
            numRating >= 3.5 ? '#f59e0b' :
                numRating >= 3.0 ? '#f97316' : '#ef4444';

    const bg = numRating >= 4.5 ? '#f0fdf4' :
        numRating >= 4.0 ? '#f0fdf4' :
            numRating >= 3.5 ? '#fffbeb' :
                numRating >= 3.0 ? '#fff7ed' : '#fef2f2';

    return (
        <View style={[styles.badge, isLarge && styles.badgeLarge, { backgroundColor: bg }]}>
            <Icon name="star" size={isLarge ? 16 : 12} color={color} />
            <Text style={[styles.text, isLarge && styles.textLarge, { color }]}>
                {numRating.toFixed(1)}
            </Text>
            {totalRides && isLarge ? (
                <Text style={[styles.ridesText, { color }]}>({totalRides} rides)</Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeLarge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
    },
    text: {
        fontSize: 11,
        fontWeight: '800',
    },
    textLarge: {
        fontSize: 14,
    },
    ridesText: {
        fontSize: 11,
        fontWeight: '600',
    },
});

export default DriverRatingBadge;
