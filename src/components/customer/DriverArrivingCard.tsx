import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share, Linking, Animated } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface Props {
    driverName: string;
    driverPhoto?: string | null;
    driverRating?: number | null;
    vehicleInfo?: string | null;
    licensePlate?: string | null;
    etaMinutes?: number | null;
    status: string;
    phoneNumber?: string | null;
    shareUrl?: string | null;
    onCall?: () => void;
    onChat?: () => void;
    onShare?: () => void;
}

const DriverArrivingCard = ({
    driverName,
    driverPhoto,
    driverRating,
    vehicleInfo,
    licensePlate,
    etaMinutes,
    status,
    phoneNumber,
    onCall,
    onChat,
    onShare,
    shareUrl,
}: Props) => {
    const [pulseAnim] = useState(new Animated.Value(1));

    useEffect(() => {
        if (status === 'ACCEPTED' || status === 'DRIVER_ARRIVING') {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [pulseAnim, status]);

    const statusLabel =
        status === 'ACCEPTED' || status === 'DRIVER_ARRIVING'
            ? 'Driver is on the way'
            : status === 'ARRIVED'
                ? 'Driver has arrived'
                : status === 'STARTED' || status === 'IN_PROGRESS'
                    ? 'Trip in progress'
                    : 'Driver assigned';

    const statusColor =
        status === 'ARRIVED'
            ? '#10b981'
            : status === 'STARTED' || status === 'IN_PROGRESS'
                ? '#2563eb'
                : '#f59e0b';

    const handleCall = () => {
        if (onCall) {
            onCall();
        } else if (phoneNumber) {
            Linking.openURL(`tel:${phoneNumber}`);
        }
    };

    const handleShare = async () => {
        if (onShare) {
            onShare();
            return;
        }
        if (shareUrl) {
            try {
                await Share.share({
                    message: `Track my DriveMate ride: ${shareUrl}`,
                    url: shareUrl,
                });
            } catch { }
        }
    };

    return (
        <View style={styles.container}>
            {/* Status bar with ETA */}
            <View style={[styles.statusBar, { backgroundColor: statusColor }]}>
                <View style={styles.statusTextRow}>
                    <Icon
                        name={status === 'ARRIVED' ? 'check-circle' : status === 'STARTED' || status === 'IN_PROGRESS' ? 'car' : 'car-clock'}
                        size={16}
                        color="#ffffff"
                    />
                    <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
                {etaMinutes != null && etaMinutes > 0 && (
                    <Animated.View style={[styles.etaBadge, { transform: [{ scale: pulseAnim }] }]}>
                        <Text style={styles.etaNumber}>{etaMinutes}</Text>
                        <Text style={styles.etaUnit}>MIN</Text>
                    </Animated.View>
                )}
            </View>

            {/* Driver info */}
            <View style={styles.driverSection}>
                <View style={styles.driverAvatar}>
                    {driverPhoto ? (
                        <Image source={{ uri: driverPhoto }} style={styles.driverPhoto} />
                    ) : (
                        <Icon name="account" size={28} color="#8A8A8A" />
                    )}
                </View>
                <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driverName}</Text>
                    {driverRating != null && driverRating > 0 && (
                        <View style={styles.ratingRow}>
                            <Icon name="star" size={14} color="#f59e0b" />
                            <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
                        </View>
                    )}
                    {vehicleInfo && <Text style={styles.vehicleText}>{vehicleInfo}</Text>}
                    {licensePlate && (
                        <View style={styles.plateBadge}>
                            <Text style={styles.plateText}>{licensePlate}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Action buttons — hidden once trip starts */}
            {status !== 'STARTED' && status !== 'IN_PROGRESS' && status !== 'COMPLETED' && (
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                    <View style={[styles.actionIcon, { backgroundColor: '#141414' }]}>
                        <Icon name="phone" size={18} color="#16a34a" />
                    </View>
                    <Text style={styles.actionLabel}>Call</Text>
                </TouchableOpacity>

                {onChat && (
                    <TouchableOpacity style={styles.actionBtn} onPress={onChat}>
                        <View style={[styles.actionIcon, { backgroundColor: '#141414' }]}>
                            <Icon name="message-text" size={18} color="#C9A84C" />
                        </View>
                        <Text style={styles.actionLabel}>Chat</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                    <View style={[styles.actionIcon, { backgroundColor: 'rgba(236,72,153,0.1)' }]}>
                        <Icon name="share-variant" size={18} color="#db2777" />
                    </View>
                    <Text style={styles.actionLabel}>Share</Text>
                </TouchableOpacity>
            </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#0A0A0A',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    statusBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    statusTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
    etaBadge: {
        backgroundColor: 'rgba(255,255,255,0.3)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    etaNumber: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 18,
    },
    etaUnit: {
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '700',
        fontSize: 11,
    },
    driverSection: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 14,
    },
    driverAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#141414',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    driverPhoto: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    driverInfo: {
        flex: 1,
        marginLeft: 14,
    },
    driverName: {
        fontSize: 17,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 2,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#CCCCCC',
    },
    vehicleText: {
        fontSize: 13,
        color: '#8A8A8A',
        marginTop: 2,
    },
    plateBadge: {
        marginTop: 4,
        alignSelf: 'flex-start',
        backgroundColor: '#1E1E1E',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    plateText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    actionBtn: {
        alignItems: 'center',
        gap: 6,
    },
    actionIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#CCCCCC',
    },
});

export default DriverArrivingCard;
