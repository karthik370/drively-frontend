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

// Quick-reply chips (Uber/Ola style)
const QUICK_REPLIES: Record<string, string[]> = {
    customer: [
        'Where are you? 📍',
        "I'm at the gate 🚪",
        'Come to main entrance',
        "I'll be there in 2 mins ⏱️",
        'Please hurry 🙏',
    ],
    driver: [
        'I am arrived ✅',
        "I'm on my way 🚗",
        "Can't find location 📍",
        'Please wait 2 mins ⏳',
        'Share exact pin 🗺️',
    ],
};

const InAppChatScreen = ({ navigation, route }: Props) => {
    const bookingId = route?.params?.bookingId;
    const userType: 'customer' | 'driver' = route?.params?.userType || 'customer';
    const otherName = route?.params?.otherName || (userType === 'customer' ? 'Driver' : 'Customer');
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
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

    const sendQuickReply = useCallback((text: string) => {
        inputRef.current?.blur();
        sendMessage(text);
    }, [sendMessage]);

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isMe = item.sender === userType;
        return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                    <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.text}</Text>
                    <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                        {new Date(item.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
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
                        <Icon name={userType === 'customer' ? 'car' : 'account'} size={18} color="#C9A84C" />
                    </View>
                    <View>
                        <Text style={styles.headerName}>{otherName}</Text>
                        <Text style={styles.headerStatus}>Active trip</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.callBtn}>
                    <Icon name="phone" size={18} color="#10b981" />
                </TouchableOpacity>
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
                {/* Quick replies */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.quickReplyList}
                    style={styles.quickReplyScroll}
                >
                    {quickReplies.map((qr, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.quickReplyChip}
                            onPress={() => sendQuickReply(qr)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.quickReplyText}>{qr}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

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

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: G.bg, borderBottomWidth: 1, borderBottomColor: G.border3,
        height: 56,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center',
    },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center',
    },
    headerName: { fontSize: 14, fontWeight: '800', color: G.textPrimary },
    headerStatus: { fontSize: 11, color: '#10b981', fontWeight: '600' },
    callBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#bbf7d0',
    },

    // Messages
    list: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
    messagesList: { paddingBottom: 12, gap: 8 },
    messagesEmpty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    msgRow: { marginBottom: 8, alignItems: 'flex-start' },
    msgRowMe: { alignItems: 'flex-end' },
    msgBubble: { maxWidth: '78%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
    msgBubbleMe: { backgroundColor: G.accent, borderBottomRightRadius: 4 },
    msgBubbleOther: {
        backgroundColor: G.bg, borderBottomLeftRadius: 4,
        borderWidth: 1, borderColor: G.border3,
    },
    msgText: { fontSize: 14, color: '#CCCCCC', fontWeight: '500', lineHeight: 20 },
    msgTextMe: { color: '#0A0A0A' },
    msgTime: { fontSize: 10, color: G.textMuted, marginTop: 4, textAlign: 'right' },
    msgTimeMe: { color: 'rgba(0,0,0,0.4)' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyText: { fontSize: 16, fontWeight: '700', color: G.textSecondary },
    emptySubtext: { fontSize: 12, color: G.textMuted, textAlign: 'center', paddingHorizontal: 24 },

    // Bottom panel
    bottomPanel: {
        backgroundColor: G.bg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    quickReplyScroll: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    quickReplyList: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
    quickReplyChip: {
        backgroundColor: G.glass2, borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
        marginRight: 6,
    },
    quickReplyText: { fontSize: 12, fontWeight: '600', color: G.accent },

    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end',
        paddingHorizontal: 12, paddingVertical: 10, gap: 10,
    },
    input: {
        flex: 1, minHeight: 44, maxHeight: 120,
        backgroundColor: G.glass2, borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: 10,
        fontSize: 14, color: G.textPrimary,
        borderWidth: 1, borderColor: G.border3,
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: G.accent, alignItems: 'center', justifyContent: 'center',
        marginBottom: 0,
    },
    sendBtnDisabled: { opacity: 0.4 },
});

export default InAppChatScreen;
