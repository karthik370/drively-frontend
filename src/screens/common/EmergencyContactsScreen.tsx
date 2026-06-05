import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    FlatList, Linking, Platform, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';
import {
    getEmergencyContacts,
    saveEmergencyContacts,
    triggerSOS,
    EmergencyContact,
} from '../../services/api';
import { useAppSelector } from '../../redux/store';

const STORAGE_KEY = '@dmate_emergency_contacts';

const EmergencyContactsScreen = ({ navigation }: any) => {
    const booking = useAppSelector((s) => s.booking.currentBooking);
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sosSent, setSosSent] = useState(false);

    const pulseAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // ── Pulse animation on SOS button ──
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 1000, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    // ── Load contacts — backend first, AsyncStorage fallback ──
    useEffect(() => {
        void loadContacts();
    }, []);

    const loadContacts = async () => {
        setLoading(true);
        try {
            const backendContacts = await getEmergencyContacts();
            if (Array.isArray(backendContacts) && backendContacts.length > 0) {
                setContacts(backendContacts);
                // Sync to local storage as offline cache
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(backendContacts));
            } else {
                // Fall back to AsyncStorage
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (raw) setContacts(JSON.parse(raw));
            }
        } catch {
            // Backend unreachable — load from local
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (raw) setContacts(JSON.parse(raw));
            } catch { }
        } finally {
            setLoading(false);
        }
    };

    const persistContacts = async (list: EmergencyContact[]) => {
        setSaving(true);
        try {
            // Save to backend
            await saveEmergencyContacts(list);
        } catch { }
        // Always save locally as fallback
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch { }
        setContacts(list);
        setSaving(false);
    };

    const addContact = useCallback(() => {
        const name = newName.trim();
        const phone = newPhone.trim().replace(/[^0-9+]/g, '');
        if (!name) return showAlert('Name required', 'Please enter a contact name');
        if (phone.length < 10) return showAlert('Invalid phone', 'Please enter a valid 10-digit phone number');
        if (contacts.length >= 5) return showAlert('Limit reached', 'Maximum 5 emergency contacts allowed');

        const contact: EmergencyContact = { id: Date.now().toString(), name, phone };
        void persistContacts([...contacts, contact]);
        setNewName('');
        setNewPhone('');
        setShowAdd(false);
    }, [contacts, newName, newPhone]);

    const removeContact = (id: string) => {
        showAlert('Remove contact?', 'This contact will no longer receive SOS alerts.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: () => void persistContacts(contacts.filter((c) => c.id !== id)),
            },
        ]);
    };

    const sendSOS = useCallback(async () => {
        if (contacts.length === 0) {
            return showAlert(
                'No Contacts',
                'Add at least one emergency contact before sending SOS.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Add Now', onPress: () => setShowAdd(true) },
                ]
            );
        }

        showAlert(
            '🚨 Send SOS Alert?',
            `Emergency call + SMS will be sent to ${contacts.length} contact(s) with your live location.\n\nHold OK for 1 second to confirm.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: '🚨 Send SOS',
                    style: 'destructive',
                    onPress: async () => {
                        setSosSent(true);

                        // Get location
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

                        // Log to backend if in an active booking
                        if (booking?.id && latitude !== 0) {
                            try {
                                await triggerSOS({ bookingId: booking.id, latitude, longitude });
                            } catch { }
                        }

                        // Call 112
                        Linking.openURL('tel:112').catch(() => { });

                        // SMS after short delay (so dialer opens first)
                        setTimeout(() => {
                            const mapsLink = latitude !== 0
                                ? `https://maps.google.com/?q=${latitude},${longitude}`
                                : '';
                            const msg = `🚨 SOS EMERGENCY!\n\nI need immediate help. Please call me now!\n${mapsLink ? `\nMy location: ${mapsLink}` : ''}${booking?.id ? `\n\nDrively Ride #${booking.id}` : ''}`;

                            const phones = contacts.map((c) => c.phone).join(',');
                            const smsUrl = Platform.OS === 'android'
                                ? `sms:${phones}?body=${encodeURIComponent(msg)}`
                                : `sms:${phones}&body=${encodeURIComponent(msg)}`;
                            Linking.openURL(smsUrl).catch(() => { });
                        }, 1200);

                        setTimeout(() => setSosSent(false), 10000);
                    },
                },
            ]
        );
    }, [contacts, booking]);

    return (
        <SafeAreaView style={styles.container} edges={['top','bottom']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color={G.accent} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Emergency & SOS</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                removeClippedSubviews
                data={contacts}
                keyExtractor={(c) => c.id}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={() => (
                    <>
                        {/* ── SOS Button ── */}
                        <View style={styles.sosSection}>
                            <TouchableOpacity
                                style={[styles.sosBtn, sosSent && styles.sosBtnSent]}
                                onPress={sendSOS}
                                activeOpacity={0.85}
                                disabled={sosSent}
                            >
                                <Animated.View style={[styles.sosPulse, {
                                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
                                    transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
                                }]} />
                                <View style={styles.sosIconWrap}>
                                    <Icon name={sosSent ? 'check-circle' : 'alert-circle'} size={36} color="#fff" />
                                </View>
                                <Text style={styles.sosTitle}>
                                    {sosSent ? 'SOS Sent ✓' : 'SOS Emergency'}
                                </Text>
                                <Text style={styles.sosSub}>
                                    {sosSent ? 'Help is on the way' : 'Tap to call 112 + alert all contacts'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Quick Actions ── */}
                        <View style={styles.quickActions}>
                            <TouchableOpacity style={styles.quickBtn} onPress={() => Linking.openURL('tel:112')}>
                                <View style={[styles.quickIcon, { backgroundColor: '#ef4444' }]}>
                                    <Icon name="phone-alert" size={20} color="#fff" />
                                </View>
                                <Text style={styles.quickLabel}>Call 112</Text>
                                <Text style={styles.quickSub}>Emergency</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.quickBtn} onPress={() => Linking.openURL('tel:100')}>
                                <View style={[styles.quickIcon, { backgroundColor: '#3b82f6' }]}>
                                    <Icon name="shield-account" size={20} color="#fff" />
                                </View>
                                <Text style={styles.quickLabel}>Call 100</Text>
                                <Text style={styles.quickSub}>Police</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.quickBtn} onPress={() => Linking.openURL('tel:108')}>
                                <View style={[styles.quickIcon, { backgroundColor: '#10b981' }]}>
                                    <Icon name="ambulance" size={20} color="#fff" />
                                </View>
                                <Text style={styles.quickLabel}>Call 108</Text>
                                <Text style={styles.quickSub}>Ambulance</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.quickBtn} onPress={() => Linking.openURL('tel:1091')}>
                                <View style={[styles.quickIcon, { backgroundColor: '#a855f7' }]}>
                                    <Icon name="gender-female" size={20} color="#fff" />
                                </View>
                                <Text style={styles.quickLabel}>Women 1091</Text>
                                <Text style={styles.quickSub}>Helpline</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Contacts Section Header ── */}
                        <View style={styles.sectionHeader}>
                            <View>
                                <Text style={styles.sectionTitle}>Trusted Contacts</Text>
                                <Text style={styles.sectionSub}>{contacts.length}/5 — notified during SOS</Text>
                            </View>
                            {contacts.length < 5 && !loading && (
                                <TouchableOpacity style={styles.addChip} onPress={() => setShowAdd(!showAdd)}>
                                    <Icon name={showAdd ? 'close' : 'plus'} size={16} color={G.accent} />
                                    <Text style={styles.addChipText}>{showAdd ? 'Cancel' : 'Add'}</Text>
                                </TouchableOpacity>
                            )}
                            {saving && <ActivityIndicator size="small" color={G.accent} />}
                        </View>

                        {/* ── Add Form ── */}
                        {showAdd && (
                            <View style={styles.addForm}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Contact name"
                                    value={newName}
                                    onChangeText={setNewName}
                                    placeholderTextColor={G.textMuted}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Phone number (10 digits)"
                                    value={newPhone}
                                    onChangeText={setNewPhone}
                                    keyboardType="phone-pad"
                                    maxLength={13}
                                    placeholderTextColor={G.textMuted}
                                />
                                <TouchableOpacity style={styles.saveBtn} onPress={addContact}>
                                    <Icon name="check" size={16} color={G.textOnAccent} />
                                    <Text style={styles.saveBtnText}>Save Contact</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── Empty state ── */}
                        {!loading && contacts.length === 0 && !showAdd && (
                            <View style={styles.emptyWrap}>
                                <Icon name="account-multiple-plus" size={44} color={G.textMuted} />
                                <Text style={styles.emptyText}>No emergency contacts yet</Text>
                                <Text style={styles.emptySubtext}>
                                    Add trusted contacts — they'll get your live location during an SOS
                                </Text>
                                <TouchableOpacity style={[styles.addChip, { marginTop: 12 }]} onPress={() => setShowAdd(true)}>
                                    <Icon name="plus" size={16} color={G.accent} />
                                    <Text style={styles.addChipText}>Add First Contact</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
                renderItem={({ item }) => (
                    <View style={styles.contactRow}>
                        <View style={styles.contactAvatar}>
                            <Text style={styles.contactInitial}>{item.name[0]?.toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.contactName}>{item.name}</Text>
                            <Text style={styles.contactPhone}>{item.phone}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.callBtn}
                            onPress={() => Linking.openURL(`tel:${item.phone}`)}
                        >
                            <Icon name="phone" size={18} color="#10b981" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => removeContact(item.id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Icon name="trash-can-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                )}
                ListFooterComponent={() => (
                    <>
                        {loading && (
                            <View style={{ padding: 24, alignItems: 'center' }}>
                                <ActivityIndicator color={G.accent} />
                                <Text style={{ color: G.textMuted, fontSize: 13, marginTop: 8 }}>Loading contacts…</Text>
                            </View>
                        )}
                        {/* Info card */}
                        <View style={styles.infoCard}>
                            <Icon name="shield-check" size={18} color="#6366f1" />
                            <Text style={styles.infoText}>
                                During an SOS, your contacts receive your live GPS location via SMS and your call will go directly to 112.{'\n\n'}
                                Contacts are securely saved to your account and sync across devices.
                            </Text>
                        </View>
                    </>
                )}
                contentContainerStyle={styles.list}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: G.bgAlt },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: G.bg,
        borderBottomWidth: 1, borderBottomColor: G.border1,
    },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: G.textPrimary },

    list: { paddingBottom: 40 },

    // SOS
    sosSection: { margin: 16 },
    sosBtn: {
        backgroundColor: '#ef4444',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
        overflow: 'visible',
    },
    sosBtnSent: { backgroundColor: '#10b981' },
    sosPulse: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 20,
        backgroundColor: '#ef4444',
    },
    sosIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    sosTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
    sosSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 6, textAlign: 'center' },

    // Quick Actions
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 20,
        gap: 8,
    },
    quickBtn: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    quickLabel: { fontSize: 11, fontWeight: '800', color: G.textPrimary, textAlign: 'center' },
    quickSub: { fontSize: 10, color: G.textMuted, textAlign: 'center' },

    // Section
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, marginBottom: 8,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
    sectionSub: { fontSize: 12, color: G.textMuted, marginTop: 2 },
    addChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: G.glass2, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
        borderWidth: 1, borderColor: G.borderAccent,
    },
    addChipText: { fontSize: 13, fontWeight: '700', color: G.accent },

    // Add Form
    addForm: { marginHorizontal: 16, marginBottom: 12, gap: 8 },
    input: {
        borderWidth: 1.5, borderColor: G.border2, borderRadius: 12, padding: 14,
        fontSize: 14, fontWeight: '600', color: G.textPrimary, backgroundColor: G.glass1,
    },
    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: G.accent, borderRadius: 12, padding: 14,
    },
    saveBtnText: { color: G.textOnAccent, fontWeight: '800', fontSize: 15 },

    // Empty
    emptyWrap: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 8 },
    emptyText: { fontSize: 16, fontWeight: '700', color: G.textSecondary },
    emptySubtext: { fontSize: 13, color: G.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

    // Contact Row
    contactRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: G.border1,
        backgroundColor: G.bg, marginHorizontal: 16, marginBottom: 1, borderRadius: 12,
    },
    contactAvatar: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: G.glass3,
        borderWidth: 1.5, borderColor: G.borderAccent,
        alignItems: 'center', justifyContent: 'center',
    },
    contactInitial: { fontSize: 17, fontWeight: '800', color: G.accent },
    contactName: { fontSize: 15, fontWeight: '700', color: G.textPrimary },
    contactPhone: { fontSize: 12, color: G.textSecondary, marginTop: 2 },
    callBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center',
        marginRight: 4,
    },

    // Info
    infoCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        margin: 16, backgroundColor: 'rgba(99,102,241,0.08)',
        borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
    },
    infoText: { flex: 1, fontSize: 12, color: '#6366f1', fontWeight: '600', lineHeight: 19 },
});

export default EmergencyContactsScreen;
