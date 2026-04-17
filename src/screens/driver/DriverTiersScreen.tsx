import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

interface Props {
    navigation: any;
}

const DriverTiersScreen = ({ navigation }: Props) => {
    const tiers = [
        {
            name: 'Classic',
            color: G.textSecondary,
            bg: '#f9fafb',
            border: '#e5e7eb',
            icon: 'car',
            minRating: 0,
            features: [
                'Standard bookings',
                'Base fare rates — You keep 100% earnings',
                'Weekly payouts',
            ],
            requirement: 'Default tier for all new drivers',
        },
        {
            name: 'Plus',
            color: G.accent,
            bg: '#eff6ff',
            border: '#bfdbfe',
            icon: 'car-sports',
            minRating: 4.2,
            features: [
                'Priority in matching',
                'Plus badge on profile',
                '100% earnings — no platform fee',
                'Daily payouts available',
                'Customer sees "Plus Driver" tag',
            ],
            requirement: '4.2+ rating · 50+ rides · 3+ months active',
        },
        {
            name: 'Elite',
            color: '#f59e0b',
            bg: '#fffbeb',
            border: '#fde68a',
            icon: 'crown',
            minRating: 4.7,
            features: [
                'Top priority matching',
                'Elite gold badge',
                '100% earnings — no platform fee',
                'Instant payouts',
                'Premium ride requests',
                'Dedicated support line',
                'Monthly bonus eligibility',
            ],
            requirement: '4.7+ rating · 200+ rides · 6+ months active',
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Driver Tiers</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Zero commission badge */}
                <View style={styles.zeroBadge}>
                    <Icon name="cash-check" size={20} color="#16a34a" />
                    <Text style={styles.zeroBadgeText}>0% Platform Fee — You keep 100% of every ride!</Text>
                </View>

                <Text style={styles.heroText}>
                    Level up your driver tier to unlock priority matching, faster payouts, and exclusive benefits.
                </Text>

                {tiers.map((tier, i) => (
                    <View key={tier.name} style={[styles.tierCard, { backgroundColor: tier.bg, borderColor: tier.border }]}>
                        {/* Header */}
                        <View style={styles.tierHeader}>
                            <View style={[styles.tierIconWrap, { backgroundColor: tier.color + '20' }]}>
                                <Icon name={tier.icon as any} size={24} color={tier.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
                                <Text style={styles.tierReq}>{tier.requirement}</Text>
                            </View>
                            <View style={[styles.earningsBadge, { backgroundColor: G.glass2 }]}>
                                <Text style={styles.earningsText}>100%</Text>
                                <Text style={styles.earningsLabel}>yours</Text>
                            </View>
                        </View>

                        {/* Features */}
                        <View style={styles.featuresList}>
                            {tier.features.map((f, j) => (
                                <View key={j} style={styles.featureRow}>
                                    <Icon name="check-circle" size={14} color={tier.color} />
                                    <Text style={styles.featureText}>{f}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ))}

                {/* How to upgrade */}
                <View style={styles.upgradeCard}>
                    <Icon name="trending-up" size={20} color="#6366f1" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.upgradeTitle}>How to upgrade?</Text>
                        <Text style={styles.upgradeText}>
                            Maintain high ratings, complete more rides, and stay active. Tiers are reviewed weekly.
                        </Text>
                    </View>
                </View>
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

    zeroBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: G.glass2, borderRadius: 12, padding: 12, marginBottom: 12,
        borderWidth: 1, borderColor: '#bbf7d0',
    },
    zeroBadgeText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#16a34a' },

    heroText: { fontSize: 14, color: G.textSecondary, fontWeight: '600', lineHeight: 22, marginBottom: 16, textAlign: 'center' },

    tierCard: {
        borderRadius: 16, padding: 16, marginBottom: 12,
        borderWidth: 1.5,
    },
    tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    tierIconWrap: {
        width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    },
    tierName: { fontSize: 18, fontWeight: '900' },
    tierReq: { fontSize: 11, color: G.textSecondary, fontWeight: '600', marginTop: 2 },
    earningsBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
    earningsText: { fontSize: 18, fontWeight: '900', color: '#16a34a' },
    earningsLabel: { fontSize: 9, fontWeight: '700', color: '#16a34a' },

    featuresList: { gap: 6 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    featureText: { fontSize: 13, color: '#CCCCCC', fontWeight: '600' },

    upgradeCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: 14, padding: 14, marginTop: 8,
        borderWidth: 1, borderColor: '#e9d5ff',
    },
    upgradeTitle: { fontSize: 13, fontWeight: '800', color: '#6366f1' },
    upgradeText: { fontSize: 12, color: '#7c3aed', fontWeight: '600', marginTop: 2, lineHeight: 18 },
});

export default DriverTiersScreen;
