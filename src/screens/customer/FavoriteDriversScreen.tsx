import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { listFavoriteDrivers, removeFavoriteDriver, type FavoriteDriver } from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const FavoriteDriversScreen = ({ navigation }: any) => {
    const [drivers, setDrivers] = useState<FavoriteDriver[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listFavoriteDrivers();
            setDrivers(Array.isArray(data) ? data : []);
        } catch {
            setDrivers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const handleRemove = (id: string, name: string) => {
        showAlert('Remove from favorites?', `${name} will be removed from your favorites list`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await removeFavoriteDriver(id);
                        setDrivers((prev) => prev.filter((d) => d.id !== id));
                    } catch (e: any) {
                        showAlert('Error', e?.message || 'Failed to remove driver');
                    }
                },
            },
        ]);
    };

    const renderDriver = useCallback(({ item }: { item: FavoriteDriver }) => (
        <View style={styles.driverCard}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                    {(item.name?.[0] || '?').toUpperCase()}
                </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.driverName} numberOfLines={1}>{item.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    {item.rating > 0 ? (
                        <View style={styles.ratingChip}>
                            <Icon name="star" size={12} color="#f59e0b" />
                            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                        </View>
                    ) : null}
                    <Text style={styles.metaText}>{item.totalTrips} trips</Text>
                    {item.isExperienced ? (
                        <View style={styles.expChip}>
                            <Icon name="shield-check" size={10} color="#10b981" />
                            <Text style={styles.expText}>Experienced</Text>
                        </View>
                    ) : null}
                </View>
            </View>
            <TouchableOpacity onPress={() => handleRemove(item.id, item.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="heart" size={22} color="#ef4444" />
            </TouchableOpacity>
        </View>
    ), []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Favorite Drivers</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.emptyWrap}>
                    <ActivityIndicator size="small" color="#C9A84C" />
                    <Text style={styles.emptySubtext}>Loading favorites…</Text>
                </View>
            ) : drivers.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <Icon name="heart-outline" size={48} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>No favorite drivers yet</Text>
                    <Text style={styles.emptySubtext}>
                        After a ride, tap the ★ button next to your driver's name to add them to favorites.
                        {'\n\n'}Favorite drivers get priority notification when you book a ride!
                    </Text>
                </View>
            ) : (
                <FlatList
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
                    data={drivers}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={renderDriver}
                />
            )}
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
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border3 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
    list: { padding: 16, paddingBottom: 32 },
    driverCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: G.bg, borderRadius: 14, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: G.border3,
    },
    avatar: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: G.glass2,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border3,
    },
    avatarText: { fontSize: 18, fontWeight: '900', color: G.accent },
    driverName: { fontSize: 15, fontWeight: '800', color: G.textPrimary },
    ratingChip: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    },
    ratingText: { fontSize: 11, fontWeight: '700', color: '#f59e0b' },
    expChip: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    },
    expText: { fontSize: 10, fontWeight: '700', color: '#10b981' },
    metaText: { fontSize: 11, color: G.textSecondary },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: G.textSecondary },
    emptySubtext: { fontSize: 13, color: G.textMuted, textAlign: 'center', lineHeight: 20 },
});

export default FavoriteDriversScreen;
