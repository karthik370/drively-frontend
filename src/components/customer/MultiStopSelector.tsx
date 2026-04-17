import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

interface Stop {
    id: string;
    address: string;
    latitude?: number;
    longitude?: number;
}

interface Props {
    stops: Stop[];
    onAddStop: () => void;
    onRemoveStop: (id: string) => void;
    onReorderStop?: (fromIndex: number, toIndex: number) => void;
    maxStops?: number;
}

const MultiStopSelector = ({ stops, onAddStop, onRemoveStop, maxStops = 4 }: Props) => {
    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Icon name="map-marker-path" size={18} color="#6366f1" />
                <Text style={styles.title}>Multiple Stops</Text>
                <Text style={styles.countBadge}>{stops.length}/{maxStops}</Text>
            </View>

            {stops.map((stop, index) => (
                <View key={stop.id} style={styles.stopRow}>
                    {/* Connector line */}
                    <View style={styles.connectorWrap}>
                        {index > 0 ? <View style={styles.connectorLine} /> : null}
                        <View style={[
                            styles.stopDot,
                            index === stops.length - 1 ? styles.stopDotLast : null,
                        ]}>
                            <Text style={styles.stopDotText}>{index + 1}</Text>
                        </View>
                        {index < stops.length - 1 ? <View style={styles.connectorLine} /> : null}
                    </View>

                    {/* Stop info */}
                    <View style={styles.stopInfo}>
                        <Text style={styles.stopLabel}>
                            {index === 0 ? 'First stop' : index === stops.length - 1 ? 'Final stop' : `Stop ${index + 1}`}
                        </Text>
                        <Text style={styles.stopAddress} numberOfLines={1}>{stop.address || 'Select location'}</Text>
                    </View>

                    {/* Remove button */}
                    {stops.length > 1 ? (
                        <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => onRemoveStop(stop.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Icon name="close-circle" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    ) : null}
                </View>
            ))}

            {/* Add stop button */}
            {stops.length < maxStops ? (
                <TouchableOpacity style={styles.addBtn} onPress={onAddStop} activeOpacity={0.7}>
                    <Icon name="plus-circle" size={18} color="#C9A84C" />
                    <Text style={styles.addBtnText}>Add another stop</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.limitReached}>
                    <Icon name="information" size={14} color="#9ca3af" />
                    <Text style={styles.limitText}>Maximum {maxStops} stops reached</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: G.bg,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: G.border3,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    title: { fontSize: 14, fontWeight: '800', color: G.textPrimary, flex: 1 },
    countBadge: {
        fontSize: 11, fontWeight: '700', color: '#6366f1',
        backgroundColor: 'rgba(139,92,246,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },

    stopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
    },
    connectorWrap: {
        width: 24,
        alignItems: 'center',
    },
    connectorLine: {
        width: 2,
        height: 10,
        backgroundColor: G.glass3,
    },
    stopDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: G.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopDotLast: {
        backgroundColor: '#ef4444',
    },
    stopDotText: {
        fontSize: 11,
        fontWeight: '800',
        color: G.textPrimary,
    },
    stopInfo: {
        flex: 1,
        paddingVertical: 4,
    },
    stopLabel: { fontSize: 10, fontWeight: '700', color: '#666666' },
    stopAddress: { fontSize: 13, fontWeight: '600', color: '#CCCCCC', marginTop: 1 },
    removeBtn: { padding: 4 },

    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 10,
        paddingVertical: 10,
        borderWidth: 1.5,
        borderColor: G.accent,
        borderRadius: 10,
        borderStyle: 'dashed',
    },
    addBtnText: { fontSize: 13, fontWeight: '700', color: G.accent },

    limitReached: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 8,
    },
    limitText: { fontSize: 11, color: '#666666', fontWeight: '600' },
});

export default MultiStopSelector;
