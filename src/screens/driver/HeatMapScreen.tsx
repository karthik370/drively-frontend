import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

const { width } = Dimensions.get('window');

interface DemandZone {
    id: string;
    latitude: number;
    longitude: number;
    radius: number;       // meters
    demand: 'LOW' | 'MEDIUM' | 'HIGH' | 'SURGE';
    label: string;
}

// Mock demand zones — in production these come from backend analytics
const MOCK_ZONES: DemandZone[] = [
    { id: '1', latitude: 17.4400, longitude: 78.4983, radius: 1500, demand: 'HIGH', label: 'Gachibowli' },
    { id: '2', latitude: 17.4375, longitude: 78.3483, radius: 1200, demand: 'SURGE', label: 'HITEC City' },
    { id: '3', latitude: 17.3850, longitude: 78.4867, radius: 1000, demand: 'MEDIUM', label: 'Charminar' },
    { id: '4', latitude: 17.4239, longitude: 78.4738, radius: 800, demand: 'LOW', label: 'Banjara Hills' },
    { id: '5', latitude: 17.4950, longitude: 78.3900, radius: 1100, demand: 'HIGH', label: 'Kukatpally' },
    { id: '6', latitude: 17.4300, longitude: 78.5500, radius: 900, demand: 'MEDIUM', label: 'LB Nagar' },
    { id: '7', latitude: 17.3616, longitude: 78.4747, radius: 1300, demand: 'HIGH', label: 'Airport Road' },
    { id: '8', latitude: 17.4500, longitude: 78.3800, radius: 1000, demand: 'SURGE', label: 'Madhapur' },
];

const DEMAND_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
    LOW: { fill: 'rgba(107,114,128,0.15)', stroke: 'rgba(107,114,128,0.4)', label: 'Low' },
    MEDIUM: { fill: 'rgba(245,158,11,0.2)', stroke: 'rgba(245,158,11,0.5)', label: 'Medium' },
    HIGH: { fill: 'rgba(239,68,68,0.25)', stroke: 'rgba(239,68,68,0.5)', label: 'High' },
    SURGE: { fill: 'rgba(168,85,247,0.3)', stroke: 'rgba(168,85,247,0.6)', label: 'Surge' },
};

const HeatMapScreen = ({ navigation }: any) => {
    const [zones, setZones] = useState<DemandZone[]>(MOCK_ZONES);
    const mapRef = useRef<MapView | null>(null);

    const initialRegion: Region = {
        latitude: 17.4300,
        longitude: 78.4500,
        latitudeDelta: 0.18,
        longitudeDelta: 0.18,
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Demand Map</Text>
                <TouchableOpacity style={styles.refreshBtn} onPress={() => setZones([...MOCK_ZONES])}>
                    <Icon name="refresh" size={18} color="#C9A84C" />
                </TouchableOpacity>
            </View>

            {/* Map */}
            <View style={styles.mapWrap}>
                <MapView
                    ref={(r) => { mapRef.current = r; }}
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFill}
                    initialRegion={initialRegion}
                >
                    {zones.map((zone) => {
                        const colors = DEMAND_COLORS[zone.demand] || DEMAND_COLORS.LOW;
                        return (
                            <Circle
                                key={zone.id}
                                center={{ latitude: zone.latitude, longitude: zone.longitude }}
                                radius={zone.radius}
                                fillColor={colors.fill}
                                strokeColor={colors.stroke}
                                strokeWidth={1.5}
                            />
                        );
                    })}
                </MapView>

                {/* Legend */}
                <View style={styles.legend}>
                    {Object.entries(DEMAND_COLORS).map(([key, val]) => (
                        <View key={key} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: val.stroke }]} />
                            <Text style={styles.legendText}>{val.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Hot zones list */}
            <View style={styles.zonesCard}>
                <Text style={styles.zonesTitle}>🔥 Hot Zones Right Now</Text>
                <View style={styles.zonesList}>
                    {zones
                        .filter((z) => z.demand === 'HIGH' || z.demand === 'SURGE')
                        .slice(0, 4)
                        .map((z) => {
                            const colors = DEMAND_COLORS[z.demand];
                            return (
                                <TouchableOpacity
                                    key={z.id}
                                    style={styles.zoneChip}
                                    onPress={() => {
                                        mapRef.current?.animateToRegion({
                                            latitude: z.latitude,
                                            longitude: z.longitude,
                                            latitudeDelta: 0.03,
                                            longitudeDelta: 0.03,
                                        }, 500);
                                    }}
                                >
                                    <View style={[styles.zoneDot, { backgroundColor: colors.stroke }]} />
                                    <Text style={styles.zoneName}>{z.label}</Text>
                                    <Text style={[styles.zoneDemand, { color: colors.stroke }]}>{colors.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                </View>
                <Text style={styles.zonesHint}>Drive to high-demand zones to get more bookings</Text>
            </View>
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
    refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center' },

    mapWrap: { flex: 1 },

    legend: {
        position: 'absolute', top: 12, right: 12,
        backgroundColor: G.bg, borderRadius: 10, padding: 10, gap: 4,
        elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 11, fontWeight: '600', color: '#CCCCCC' },

    zonesCard: {
        backgroundColor: G.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 16, marginTop: -12,
        elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 10,
    },
    zonesTitle: { fontSize: 15, fontWeight: '900', color: G.textPrimary, marginBottom: 10 },
    zonesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    zoneChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: G.bgAlt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
        borderWidth: 1, borderColor: G.border3,
    },
    zoneDot: { width: 8, height: 8, borderRadius: 4 },
    zoneName: { fontSize: 12, fontWeight: '700', color: G.textPrimary },
    zoneDemand: { fontSize: 10, fontWeight: '800' },
    zonesHint: { fontSize: 11, color: G.textMuted, fontWeight: '600' },
});

export default HeatMapScreen;
