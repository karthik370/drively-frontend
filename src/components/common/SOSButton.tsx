import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Linking, Platform } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showAlert } from './CustomAlert';
import { G } from '../../constants/glassStyles';

const EMERGENCY_CONTACTS_KEY = '@dmate_emergency_contacts';

interface Props {
    bookingId?: string;
    compact?: boolean;
}

const SOSButton = ({ bookingId, compact = false }: Props) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;

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

    const handleSOS = async () => {
        showAlert(
            '🚨 Emergency SOS',
            'This will:\n• Call emergency services (112)\n• Alert your emergency contacts\n\nAre you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Call 112',
                    style: 'destructive',
                    onPress: () => {
                        Linking.openURL('tel:112').catch(() => { });
                        void notifyEmergencyContacts();
                    },
                },
            ]
        );
    };

    const notifyEmergencyContacts = async () => {
        try {
            const raw = await AsyncStorage.getItem(EMERGENCY_CONTACTS_KEY);
            if (!raw) return;
            const contacts = JSON.parse(raw);
            if (!contacts.length) return;

            const message = `EMERGENCY SOS from Drively ride${bookingId ? ` #${bookingId}` : ''}. Please check on me immediately!`;
            const phones = contacts.map((c: any) => c.phone).join(',');
            const smsUrl = Platform.OS === 'android'
                ? `sms:${phones}?body=${encodeURIComponent(message)}`
                : `sms:${phones}&body=${encodeURIComponent(message)}`;
            Linking.openURL(smsUrl).catch(() => { });
        } catch { }
    };

    if (compact) {
        return (
            <TouchableOpacity style={styles.compactBtn} onPress={handleSOS} activeOpacity={0.7}>
                <Icon name="alert-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity style={styles.container} onPress={handleSOS} activeOpacity={0.8}>
            <Animated.View
                style={[
                    styles.pulseRing,
                    {
                        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
                        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                    },
                ]}
            />
            <View style={styles.inner}>
                <Icon name="alert-circle" size={24} color="#ffffff" />
                <Text style={styles.text}>SOS</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
    },
    pulseRing: {
        position: 'absolute',
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: '#ef4444',
    },
    inner: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    text: {
        fontSize: 8,
        fontWeight: '900',
        color: G.textPrimary,
        letterSpacing: 1,
    },
    compactBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1A0F0F',
        borderWidth: 1.5,
        borderColor: '#fecaca',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default SOSButton;
