import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Easing,
    Linking,
    Platform,
    PanResponder,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { G } from '../../constants/glassStyles';
import { triggerSOS, resolveEmergency } from '../../services/api';
import { showAlert } from './CustomAlert';

const EMERGENCY_CONTACTS_KEY = '@dmate_emergency_contacts';
const HOLD_DURATION = 3000; // 3 seconds hold

interface Props {
    bookingId?: string;
    compact?: boolean;
}

const SOSButton = ({ bookingId, compact = false }: Props) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const [isHolding, setIsHolding] = useState(false);
    const [isTriggered, setIsTriggered] = useState(false);
    const [isCooling, setIsCooling] = useState(false);
    const [emergencyId, setEmergencyId] = useState<string | null>(null);

    const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
    const holdAnimRef = useRef<Animated.CompositeAnimation | null>(null);
    const cooldownRef = useRef<NodeJS.Timeout | null>(null);

    // ── Pulse animation (always running) ──
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    const resetProgress = useCallback(() => {
        holdAnimRef.current?.stop();
        progressAnim.setValue(0);
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    }, [progressAnim, scaleAnim]);

    const executeSOS = useCallback(async () => {
        setIsHolding(false);
        setIsTriggered(true);
        progressAnim.setValue(1);

        // Get current GPS location
        let latitude = 0;
        let longitude = 0;
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                latitude = loc.coords.latitude;
                longitude = loc.coords.longitude;
            }
        } catch { }

        // 1. Log to backend DB (non-blocking if fails)
        if (bookingId && latitude !== 0) {
            try {
                const result = await triggerSOS({ bookingId, latitude, longitude });
                if (result?.emergencyId) {
                    setEmergencyId(result.emergencyId);
                }
            } catch { }
        }

        // 2. Call 112
        Linking.openURL('tel:112').catch(() => { });

        // 3. SMS emergency contacts with location + share link
        setTimeout(async () => {
            try {
                const raw = await AsyncStorage.getItem(EMERGENCY_CONTACTS_KEY);
                const contacts = raw ? JSON.parse(raw) : [];
                if (contacts.length === 0) return;

                const mapsLink = latitude !== 0
                    ? `https://maps.google.com/?q=${latitude},${longitude}`
                    : '';
                const msg = `🚨 SOS EMERGENCY from Drively!\n\nI need help immediately. Please call me now!\n${mapsLink ? `\nMy location: ${mapsLink}` : ''}${bookingId ? `\n\nDrively Ride Booking #${bookingId}` : ''}`;

                const phones = contacts.map((c: any) => c.phone).join(',');
                const smsUrl = Platform.OS === 'android'
                    ? `sms:${phones}?body=${encodeURIComponent(msg)}`
                    : `sms:${phones}&body=${encodeURIComponent(msg)}`;
                Linking.openURL(smsUrl).catch(() => { });
            } catch { }
        }, 1500);

        // 4. Cooldown 30s to prevent accidental spam
        setIsCooling(true);
        cooldownRef.current = setTimeout(() => {
            setIsTriggered(false);
            setIsCooling(false);
            progressAnim.setValue(0);
        }, 30000);
    }, [bookingId, progressAnim]);

    const onPressIn = useCallback(() => {
        if (isCooling) return;
        setIsHolding(true);

        // Scale up
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }).start();

        // Fill progress ring
        holdAnimRef.current = Animated.timing(progressAnim, {
            toValue: 1,
            duration: HOLD_DURATION,
            easing: Easing.linear,
            useNativeDriver: false,
        });
        holdAnimRef.current.start(({ finished }) => {
            if (finished) {
                void executeSOS();
            }
        });
    }, [isCooling, progressAnim, scaleAnim, executeSOS]);

    const onPressOut = useCallback(() => {
        if (isTriggered) return;
        setIsHolding(false);
        resetProgress();
    }, [isTriggered, resetProgress]);

    const handleResolve = useCallback(() => {
        showAlert('Mark yourself safe?', 'This will resolve the emergency alert.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'I\'m Safe',
                style: 'default',
                onPress: async () => {
                    if (emergencyId) {
                        try { await resolveEmergency(emergencyId); } catch { }
                    }
                    setIsTriggered(false);
                    setIsCooling(false);
                    setEmergencyId(null);
                    progressAnim.setValue(0);
                    if (cooldownRef.current) clearTimeout(cooldownRef.current);
                },
            },
        ]);
    }, [emergencyId, progressAnim]);

    useEffect(() => {
        return () => {
            holdAnimRef.current?.stop();
            if (cooldownRef.current) clearTimeout(cooldownRef.current);
        };
    }, []);

    const progressInterp = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // ── Compact version (in TrackingScreen header) ──
    if (compact) {
        if (isTriggered) {
            return (
                <TouchableOpacity style={styles.compactActive} onPress={handleResolve}>
                    <Animated.View style={[styles.compactPulseRing, {
                        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                    }]} />
                    <Icon name="alert-circle" size={18} color="#fff" />
                    <Text style={styles.compactActiveText}>SOS</Text>
                </TouchableOpacity>
            );
        }
        return (
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                    style={[styles.compactBtn, isHolding && styles.compactBtnHolding]}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    delayLongPress={HOLD_DURATION}
                    disabled={isCooling}
                    activeOpacity={0.85}
                >
                    <Icon name="alert-circle" size={20} color={isCooling ? '#888' : '#ef4444'} />
                </TouchableOpacity>
            </Animated.View>
        );
    }

    // ── Full version ──
    if (isTriggered) {
        return (
            <TouchableOpacity style={styles.triggeredContainer} onPress={handleResolve} activeOpacity={0.85}>
                <Animated.View style={[styles.pulseRingLarge, {
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                    transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
                }]} />
                <View style={styles.triggeredInner}>
                    <Icon name="alert-circle" size={28} color="#ffffff" />
                    <Text style={styles.triggeredText}>SOS ACTIVE</Text>
                    <Text style={styles.triggeredSub}>Tap to mark safe</Text>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            {/* Outer pulse ring */}
            <Animated.View style={[styles.pulseRing, {
                opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
                transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
            }]} />

            {/* Progress arc while holding */}
            {isHolding && (
                <View style={styles.progressRing}>
                    <Animated.View style={[styles.progressFill, { transform: [{ rotate: progressInterp }] }]} />
                </View>
            )}

            <TouchableOpacity
                style={styles.inner}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={isCooling}
                activeOpacity={0.85}
            >
                <Icon name="alert-circle" size={24} color="#ffffff" />
                <Text style={styles.text}>SOS</Text>
            </TouchableOpacity>

            {isHolding && (
                <Text style={styles.holdHint}>Hold…</Text>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 64,
        height: 64,
    },
    pulseRing: {
        position: 'absolute',
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: '#ef4444',
    },
    pulseRingLarge: {
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#ef4444',
    },
    progressRing: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: 'rgba(239,68,68,0.3)',
        overflow: 'hidden',
    },
    progressFill: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: '50%',
        height: '100%',
        backgroundColor: '#ef4444',
        transformOrigin: 'left center',
    },
    inner: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    text: {
        fontSize: 8,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 1,
    },
    holdHint: {
        position: 'absolute',
        bottom: -18,
        fontSize: 10,
        fontWeight: '700',
        color: '#ef4444',
    },

    // Compact
    compactBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#1A0F0F',
        borderWidth: 1.5,
        borderColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactBtnHolding: {
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderColor: '#ff6b6b',
    },
    compactActive: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ef4444',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        elevation: 6,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    compactPulseRing: {
        position: 'absolute',
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#ef4444',
    },
    compactActiveText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
    },

    // Triggered full
    triggeredContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 72,
        height: 72,
    },
    triggeredInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 12,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 14,
    },
    triggeredText: {
        fontSize: 7,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    triggeredSub: {
        fontSize: 6,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
    },
});

export default SOSButton;
