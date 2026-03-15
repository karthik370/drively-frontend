import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@dmate_favorite_drivers';

interface FavoriteDriver {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    rating?: number;
    profileImage?: string;
    savedAt: string;
}

const FavoriteDriversScreen = ({ navigation }: any) => {
    const [favorites, setFavorites] = useState<FavoriteDriver[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void loadFavorites();
    }, []);

    const loadFavorites = async () => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) setFavorites(JSON.parse(raw));
        } catch { } finally {
            setLoading(false);
        }
    };

    const removeFavorite = (id: string) => {
        Alert.alert('Remove from favorites?', 'This driver will be removed from your favorites list', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    const updated = favorites.filter((d) => d.id !== id);
                    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                    setFavorites(updated);
                },
            },
        ]);
    };

    const renderDriver = useCallback(({ item }: { item: FavoriteDriver }) => (
        <View style={styles.driverCard}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                    {(item.firstName?.[0] || '?').toUpperCase()}
                </Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{`${item.firstName} ${item.lastName}`.trim()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    {item.rating ? (
                        <View style={styles.ratingChip}>
                            <Icon name="star" size={12} color="#f59e0b" />
                            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                        </View>
                    ) : null}
                    <Text style={styles.savedDate}>
                        Saved {new Date(item.savedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                </View>
            </View>
            <TouchableOpacity onPress={() => removeFavorite(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="heart" size={22} color="#ef4444" />
            </TouchableOpacity>
        </View>
    ), [favorites]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Favorite Drivers</Text>
                <View style={{ width: 40 }} />
            </View>

            {favorites.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <Icon name="heart-outline" size={48} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>No favorite drivers yet</Text>
                    <Text style={styles.emptySubtext}>After a ride, you can save your driver to favorites for easy re-booking</Text>
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={renderDriver}
                />
            )}
        </SafeAreaView>
    );
};

// Helper: call from TrackingScreen after rating to save a driver as favorite
export const saveFavoriteDriver = async (driver: FavoriteDriver) => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const existing: FavoriteDriver[] = raw ? JSON.parse(raw) : [];
        if (existing.find((d) => d.id === driver.id)) return; // already saved
        const updated = [{ ...driver, savedAt: new Date().toISOString() }, ...existing].slice(0, 20);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { }
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111111' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0A0A0A',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)',
    },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
    list: { padding: 16 },

    driverCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: '#0A0A0A', borderRadius: 14, padding: 14, marginBottom: 10,
        elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
    },
    avatar: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: '#141414',
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '800', color: '#C9A84C' },
    driverName: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
    ratingChip: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#1A1708', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    },
    ratingText: { fontSize: 11, fontWeight: '700', color: '#b45309' },
    savedDate: { fontSize: 11, color: '#666666' },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: '#8A8A8A' },
    emptySubtext: { fontSize: 13, color: '#666666', textAlign: 'center', lineHeight: 20 },
});

export default FavoriteDriversScreen;
