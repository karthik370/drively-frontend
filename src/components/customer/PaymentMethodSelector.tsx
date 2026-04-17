import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

export type PaymentOption = 'CASH' | 'UPI' | 'WALLET' | 'CARD';

interface Props {
    selected: PaymentOption;
    onSelect: (method: PaymentOption) => void;
    walletBalance?: number;
}

const METHODS: { key: PaymentOption; icon: string; label: string; desc: string; color: string }[] = [
    { key: 'CASH', icon: 'cash', label: 'Cash', desc: 'Pay the driver directly', color: '#10b981' },
    { key: 'UPI', icon: 'cellphone-nfc', label: 'UPI', desc: 'GPay, PhonePe, Paytm', color: '#7c3aed' },
    { key: 'WALLET', icon: 'wallet', label: 'Wallet', desc: 'Pay from Drively wallet', color: G.accent },
    { key: 'CARD', icon: 'credit-card', label: 'Card', desc: 'Debit / Credit card', color: '#f59e0b' },
];

const PaymentMethodSelector = ({ selected, onSelect, walletBalance }: Props) => {
    const [showModal, setShowModal] = useState(false);

    const selectedMethod = METHODS.find((m) => m.key === selected) ?? METHODS[0];

    const handleSelect = useCallback(
        (key: PaymentOption) => {
            onSelect(key);
            setShowModal(false);
        },
        [onSelect]
    );

    return (
        <>
            <TouchableOpacity style={styles.selector} onPress={() => setShowModal(true)} activeOpacity={0.7}>
                <View style={[styles.iconWrap, { backgroundColor: `${selectedMethod.color}15` }]}>
                    <Icon name={selectedMethod.icon as any} size={20} color={selectedMethod.color} />
                </View>
                <View style={styles.selectorInfo}>
                    <Text style={styles.selectorLabel}>{selectedMethod.label}</Text>
                    <Text style={styles.selectorDesc}>{selectedMethod.desc}</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
                    <View style={styles.modalSheet}>
                        <View style={styles.handleBar} />
                        <Text style={styles.modalTitle}>Payment Method</Text>
                        <Text style={styles.modalSubtitle}>Choose how you'd like to pay</Text>

                        {METHODS.map((method) => {
                            const isActive = selected === method.key;
                            return (
                                <TouchableOpacity
                                    key={method.key}
                                    style={[styles.methodRow, isActive && styles.methodRowActive]}
                                    onPress={() => handleSelect(method.key)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.methodIcon, { backgroundColor: `${method.color}15` }]}>
                                        <Icon name={method.icon as any} size={22} color={method.color} />
                                    </View>
                                    <View style={styles.methodInfo}>
                                        <Text style={styles.methodLabel}>{method.label}</Text>
                                        <Text style={styles.methodDesc}>
                                            {method.key === 'WALLET' && walletBalance !== undefined
                                                ? `Balance: ₹${walletBalance.toFixed(0)}`
                                                : method.desc}
                                        </Text>
                                    </View>
                                    <View style={[styles.radio, isActive && styles.radioActive]}>
                                        {isActive && <View style={styles.radioDot} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: G.bg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: G.border3,
        padding: 14,
        marginTop: 10,
        marginBottom: 6,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectorInfo: {
        flex: 1,
        marginLeft: 12,
    },
    selectorLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: G.textPrimary,
    },
    selectorDesc: {
        fontSize: 12,
        color: '#8A8A8A',
        marginTop: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: G.bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 34,
        paddingTop: 12,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: G.glass3,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: G.textPrimary,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#8A8A8A',
        marginTop: 4,
        marginBottom: 20,
    },
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: G.bgAlt,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: G.border3,
        padding: 14,
        marginBottom: 10,
    },
    methodRowActive: {
        borderColor: G.accent,
        backgroundColor: G.glass2,
    },
    methodIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    methodInfo: {
        flex: 1,
        marginLeft: 14,
    },
    methodLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: G.textPrimary,
    },
    methodDesc: {
        fontSize: 12,
        color: '#8A8A8A',
        marginTop: 2,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: G.border3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioActive: {
        borderColor: G.accent,
    },
    radioDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: G.accent,
    },
});

export default PaymentMethodSelector;
