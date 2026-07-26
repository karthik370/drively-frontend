import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
    Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import socketService from '../../services/socketService';
import { G } from '../../constants/glassStyles';

interface ChatMessage {
    id: string;
    text: string;
    sender: 'customer' | 'driver';
    timestamp: string;
}

interface Props {
    navigation: any;
    route: any;
}

// ─── Quick-reply chip definitions ────────────────────────────────────────────
// Research-based like Uber / Rapido / Ola — situational, short, tappable
const QUICK_REPLIES: Record<string, { icon: string; text: string }[]> = {
    customer: [
        { icon: '📍', text: "Where are you?" },
        { icon: '🚪', text: "I'm at the gate" },
        { icon: '🏢', text: "I'm at the main entrance" },
        { icon: '⏱️', text: "I'll be there in 2 mins" },
        { icon: '🙏', text: "Please hurry" },
        { icon: '📞', text: "Please call me" },
        { icon: '🅿️', text: "Can you come to parking?" },
        { icon: '✅', text: "I can see you" },
        { icon: '🔄', text: "I'm on my way down" },
        { icon: '❓', text: "Which car are you in?" },
    ],
    driver: [
        { icon: '✅', text: "I have arrived" },
        { icon: '🚗', text: "I'm on my way" },
        { icon: '📍', text: "Can't find the location" },
        { icon: '⏳', text: "Please wait 2 mins" },
        { icon: '🗺️', text: "Please share exact pin" },
        { icon: '📞', text: "Please call me" },
        { icon: '🅿️', text: "I'm in the parking area" },
        { icon: '👀', text: "I'm outside, look for me" },
        { icon: '🚦', text: "Stuck in traffic, coming" },
        { icon: '🏁', text: "Starting your trip now" },
    ],
};

const InAppChatScreen = ({ navigation, route }: Props) => {
    const bookingId = route?.params?.bookingId;
    const userType: 'customer' | 'driver' = route?.params?.userType || 'customer';
    const otherName = route?.params?.otherName
        || (userType === 'customer' ? 'Driver' : 'Customer');
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    // Track which chip indexes have been used — hide after sending (no re-sending same msg)
    const [usedChips, setUsedChips] = useState<Set<number>>(new Set());
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    const quickReplies = QUICK_REPLIES[userType] ?? QUICK_REPLIES.customer;

    useEffect(() => {
        if (!bookingId) return;

        const handleMessage = (data: any) => {
            if (data?.bookingId !== bookingId) return;
            const msg: ChatMessage = {
                id: Date.now().toString(),
                text: data.message,
                sender: data.senderType === userType ? userType : (userType === 'customer' ? 'driver' : 'customer'),
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, msg]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
        };

        socketService.on('chat:message', handleMessage);
        return () => { socketService.off('chat:message', handleMessage); };
    }, [bookingId, userType]);

    const sendMessage = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed || !bookingId) return;

        const msg: ChatMessage = {
            id: Date.now().toString(),
            text: trimmed,
            sender: userType,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, msg]);
        setInput('');

        try {
            socketService.emit('chat:send', { bookingId, message: trimmed, senderType: userType });
        } catch { }

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }, [bookingId, userType]);

    const sendQuickReply = useCallback((text: string, index: number) => {
        inputRef.current?.blur();
        sendMessage(text);
        // Mark chip as used — hide it so it doesn't clutter after sending
        setUsedChips(prev => new Set(prev).add(index));
    }, [sendMessage]);

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isMe = item.sender === userType;
        const timeStr = (() => {
            try {
                const d = new Date(item.timestamp);
                return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            } catch { return ''; }
        })();
        return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                {!isMe && (
                    <View style={styles.avatarDot}>
                        <Icon name={userType === 'customer' ? 'car' : 'account'} size={12} color="#C9A84C" />
                    </View>
                )}
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                    <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.text}</Text>
                    <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{timeStr}</Text>
                </View>
            </View>
        );
    };

    const headerHeight = 56 + insets.top;

    return (
        <KeyboardAvoidingView
            style={[styles.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <View style={styles.headerAvatar}>
                        <Icon name={userType === 'customer' ? 'car' : 'account-circle'} size={20} color="#C9A84C" />
                    </View>
                    <View>
                        <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
                        <View style={styles.activeDot}>
                            <View style={styles.greenDot} />
                            <Text style={styles.headerStatus}>Active trip</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Trip context safety banner */}
            <View style={styles.contextBanner}>
                <Icon name="shield-check" size={13} color="#C9A84C" />
                <Text style={styles.contextText}>Messages are only visible during this trip for your safety</Text>
            </View>

            {/* Messages list */}
            <FlatList
                ref={flatListRef}
                style={styles.list}
                data={messages}
                keyExtractor={(m) => m.id}
                renderItem={renderMessage}
                contentContainerStyle={messages.length ? styles.messagesList : styles.messagesEmpty}
                removeClippedSubviews
                maxToRenderPerBatch={8}
                windowSize={5}
                initialNumToRender={8}
                onContentSizeChange={() => {
                    try { flatListRef.current?.scrollToEnd({ animated: false }); } catch { }
                }}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Icon name="chat-outline" size={48} color="#444" />
                        <Text style={styles.emptyText}>No messages yet</Text>
                        <Text style={styles.emptySubtext}>Use quick replies below or type a message</Text>
                    </View>
                }
            />

            {/* Bottom panel — quick replies + input row */}
            <View style={[styles.bottomPanel, { paddingBottom: insets.bottom }]}>
                {/* Quick replies section */}
                <View style={styles.quickReplySection}>
                    <Text style={styles.quickReplyLabel}>Quick replies</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.quickReplyList}
                        style={styles.quickReplyScroll}
                    >
                        {quickReplies.map((qr, i) => {
                            if (usedChips.has(i)) return null;
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={styles.quickReplyChip}
                                    onPress={() => sendQuickReply(qr.text, i)}
                                    activeOpacity={0.65}
                                >
                                    <Text style={styles.chipEmoji}>{qr.icon}</Text>
                                    <Text style={styles.quickReplyText}>{qr.text}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Input row */}
                <View style={styles.inputRow}>
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Type a message…"
                        placeholderTextColor="#555"
                        multiline
                        maxLength={500}
                        blurOnSubmit={false}
                        returnKeyType="send"
                        onSubmitEditing={() => sendMessage(input)}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                        onPress={() => sendMessage(input)}
                        disabled={!input.trim()}
                        activeOpacity={0.8}
                    >
                        <Icon name="send" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: G.bgAlt },

    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: G.bg,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
        height: 64,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center',
    },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(201,168,76,0.12)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.35)',
    },
    headerName: { fontSize: 15, fontWeight: '800', color: G.textPrimary, maxWidth: 180 },
    activeDot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
    headerStatus: { fontSize: 11, color: '#10b981', fontWeight: '600' },

    // Context safety banner
    contextBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(201,168,76,0.07)',
        paddingHorizontal: 14, paddingVertical: 7,
        borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.12)',
    },
    contextText: { fontSize: 11, color: '#888', flex: 1, lineHeight: 15 },

    // Messages
    list: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    messagesList: { paddingBottom: 16, gap: 10 },
    messagesEmpty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 2 },
    msgRowMe: { justifyContent: 'flex-end' },
    avatarDot: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: 'rgba(201,168,76,0.1)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
        marginBottom: 2,
    },
    msgBubble: { maxWidth: '75%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
    msgBubbleMe: { backgroundColor: '#C9A84C', borderBottomRightRadius: 5 },
    msgBubbleOther: {
        backgroundColor: G.bg, borderBottomLeftRadius: 5,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    msgText: { fontSize: 14, color: '#CCCCCC', fontWeight: '500', lineHeight: 20 },
    msgTextMe: { color: '#0A0A0A', fontWeight: '600' },
    msgTime: { fontSize: 10, color: G.textMuted, marginTop: 4, textAlign: 'right' },
    msgTimeMe: { color: 'rgba(0,0,0,0.45)', textAlign: 'right' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyText: { fontSize: 16, fontWeight: '700', color: G.textSecondary },
    emptySubtext: { fontSize: 12, color: G.textMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },

    // Bottom panel
    bottomPanel: { backgroundColor: G.bg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
    quickReplySection: { paddingTop: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    quickReplyLabel: {
        fontSize: 10, fontWeight: '700', color: '#555',
        textTransform: 'uppercase', letterSpacing: 0.8,
        paddingHorizontal: 14, marginBottom: 6,
    },
    quickReplyScroll: {},
    quickReplyList: { paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
    quickReplyChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: G.glass2, borderRadius: 22,
        paddingHorizontal: 13, paddingVertical: 8,
        borderWidth: 1, borderColor: 'rgba(201,168,76,0.28)',
        marginRight: 6,
    },
    chipEmoji: { fontSize: 13 },
    quickReplyText: { fontSize: 12, fontWeight: '600', color: '#D4AF62' },

    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end',
        paddingHorizontal: 12, paddingVertical: 10, gap: 10,
    },
    input: {
        flex: 1, minHeight: 44, maxHeight: 120,
        backgroundColor: G.glass2, borderRadius: 16,
        paddingHorizontal: 14, paddingVertical: 10,
        fontSize: 14, color: G.textPrimary,
        borderWidth: 1, borderColor: G.border3,
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: '#C9A84C',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#C9A84C', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
    },
    sendBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
});

export default InAppChatScreen;
