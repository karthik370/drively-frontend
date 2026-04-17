import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, FlatList, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const STORAGE_KEY = '@dmate_emergency_contacts';

interface EmergencyContact {
    id: string;
    name: string;
    phone: string;
}

const EmergencyContactsScreen = ({ navigation }: any) => {
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');

    useEffect(() => {
        void loadContacts();
    }, []);

    const loadContacts = async () => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) setContacts(JSON.parse(raw));
        } catch { }
    };

    const saveContacts = async (list: EmergencyContact[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            setContacts(list);
        } catch { }
    };

    const addContact = useCallback(() => {
        const name = newName.trim();
        const phone = newPhone.trim().replace(/[^0-9+]/g, '');
        if (!name) return showAlert('Name required', 'Please enter a contact name');
        if (phone.length < 10) return showAlert('Invalid phone', 'Please enter a valid phone number');
        if (contacts.length >= 5) return showAlert('Limit reached', 'Maximum 5 emergency contacts');

        const contact: EmergencyContact = { id: Date.now().toString(), name, phone };
        saveContacts([...contacts, contact]);
        setNewName('');
        setNewPhone('');
        setShowAdd(false);
    }, [contacts, newName, newPhone]);

    const removeContact = (id: string) => {
        showAlert('Remove contact?', 'This contact will no longer receive SOS alerts', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => saveContacts(contacts.filter((c) => c.id !== id)) },
        ]);
    };

    const sendSOS = () => {
        if (contacts.length === 0) {
            return showAlert('No contacts', 'Please add at least one emergency contact');
        }
        showAlert('🚨 Send SOS Alert?', `Emergency SMS will be sent to ${contacts.length} contact(s) with your live location.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send SOS',
                style: 'destructive',
                onPress: () => {
                    const message = 'EMERGENCY: I need help! Track my live Drively ride location. Please call me immediately.';
                    const phones = contacts.map((c) => c.phone).join(',');
                    const smsUrl = Platform.OS === 'android'
                        ? `sms:${phones}?body=${encodeURIComponent(message)}`
                        : `sms:${phones}&body=${encodeURIComponent(message)}`;
                    Linking.openURL(smsUrl).catch(() => showAlert('SMS failed', 'Could not open messages app'));
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Emergency Contacts</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* SOS Button */}
            <TouchableOpacity style={styles.sosBtn} onPress={sendSOS} activeOpacity={0.8}>
                <View style={styles.sosInner}>
                    <Icon name="alert-circle" size={32} color="#ffffff" />
                    <Text style={styles.sosText}>SOS Emergency</Text>
                    <Text style={styles.sosSubtext}>Tap to alert all emergency contacts</Text>
                </View>
            </TouchableOpacity>

            {/* Contacts list */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Trusted Contacts ({contacts.length}/5)</Text>
                    {contacts.length < 5 ? (
                        <TouchableOpacity style={styles.addChip} onPress={() => setShowAdd(!showAdd)}>
                            <Icon name={showAdd ? 'close' : 'plus'} size={16} color="#C9A84C" />
                            <Text style={styles.addChipText}>{showAdd ? 'Cancel' : 'Add'}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {showAdd ? (
                    <View style={styles.addForm}>
                        <TextInput
                            style={styles.input}
                            placeholder="Contact name"
                            value={newName}
                            onChangeText={setNewName}
                            placeholderTextColor="#444444"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Phone number"
                            value={newPhone}
                            onChangeText={setNewPhone}
                            keyboardType="phone-pad"
                            placeholderTextColor="#444444"
                        />
                        <TouchableOpacity style={styles.saveBtn} onPress={addContact}>
                            <Text style={styles.saveBtnText}>Save Contact</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {contacts.length === 0 ? (
                    <View style={styles.emptyWrap}>
                        <Icon name="shield-account" size={40} color="#d1d5db" />
                        <Text style={styles.emptyText}>No emergency contacts added</Text>
                        <Text style={styles.emptySubtext}>Add contacts who will be notified during SOS</Text>
                    </View>
                ) : (
                    <FlatList
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
                        data={contacts}
                        keyExtractor={(c) => c.id}
                        scrollEnabled={false}
                        renderItem={({ item }) => (
                            <View style={styles.contactRow}>
                                <View style={styles.contactAvatar}>
                                    <Text style={styles.contactInitial}>{item.name[0]?.toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.contactName}>{item.name}</Text>
                                    <Text style={styles.contactPhone}>{item.phone}</Text>
                                </View>
                                <TouchableOpacity onPress={() => removeContact(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Icon name="trash-can-outline" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        )}
                    />
                )}
            </View>

            {/* Info */}
            <View style={styles.infoCard}>
                <Icon name="information" size={16} color="#6366f1" />
                <Text style={styles.infoText}>
                    During an SOS, your live trip location and a help message will be sent to all contacts via SMS.
                </Text>
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

    sosBtn: { margin: 16, borderRadius: 16, overflow: 'hidden' },
    sosInner: {
        backgroundColor: '#ef4444', padding: 20, alignItems: 'center',
        elevation: 6, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    sosText: { color: G.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 8 },
    sosSubtext: { color: '#fecaca', fontSize: 12, fontWeight: '600', marginTop: 4 },

    section: { marginHorizontal: 16, backgroundColor: G.bg, borderRadius: 16, padding: 16, marginBottom: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: G.textPrimary },
    addChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: G.glass2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    },
    addChipText: { fontSize: 12, fontWeight: '700', color: G.accent },

    addForm: { marginBottom: 12, gap: 8 },
    input: {
        borderWidth: 1.5, borderColor: G.border3, borderRadius: 10, padding: 12,
        fontSize: 14, fontWeight: '600', color: G.textPrimary,
    },
    saveBtn: { backgroundColor: G.accent, borderRadius: 10, padding: 12, alignItems: 'center' },
    saveBtnText: { color: G.textPrimary, fontWeight: '800', fontSize: 14 },

    emptyWrap: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    emptyText: { fontSize: 14, fontWeight: '700', color: G.textSecondary },
    emptySubtext: { fontSize: 12, color: G.textMuted },

    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: G.border3 },
    contactAvatar: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center',
    },
    contactInitial: { fontSize: 16, fontWeight: '800', color: G.accent },
    contactName: { fontSize: 14, fontWeight: '700', color: G.textPrimary },
    contactPhone: { fontSize: 12, color: G.textSecondary, marginTop: 2 },

    infoCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        marginHorizontal: 16, backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: 12, padding: 12,
    },
    infoText: { flex: 1, fontSize: 12, color: '#6366f1', fontWeight: '600', lineHeight: 18 },
});

export default EmergencyContactsScreen;
