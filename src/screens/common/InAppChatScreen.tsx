import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
    Platform, Keyboard, KeyboardEvent,
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

const InAppChatScreen = ({ navigation, route }: Props) => {
    const bookingId = route?.params?.bookingId;
    const userType = route?.params?.userType || 'customer';
    const otherName = route?.params?.otherName || (userType === 'customer' ? 'Driver' : 'Customer');
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    // Direct keyboard height measurement — most reliable approach on Android
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const quickReplies = userType === 'customer'
        ? ['Where are you?', 'I\'m waiting at gate', 'Please come to basement parking', 'I\'ll be out in 5 mins']
        : ['On my way', 'Reached location', 'Please share exact pin', 'Will be there in 5 mins'];

    // Listen to keyboard height directly — works on ALL Android versions/devices
    useEffect(() => {
        const onShow = (e: KeyboardEvent) => {
            setKeyboardHeight(e.endCoordinates.height);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        };
        const onHide = () => setKeyboardHeight(0);

        const show = Keyboard.addListener('keyboardDidShow', onShow);
        const hide = Keyboard.addListener('keyboardDidHide', onHide);
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

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
        };

        socketService.on('chat:message', handleMessage);
        return () => {
            socketService.off('chat:message', handleMessage);
        };
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
            socketService.emit('chat:send', {
                bookingId,
                message: trimmed,
                senderType: userType,
            });
        } catch { }

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, [bookingId, userType]);

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

    // On iOS use the system bottom inset. On Android use measured keyboard height.
    // This bypasses KeyboardAvoidingView entirely — direct and reliable on all devices.
    const bottomOffset = Platform.OS === 'ios' ? insets.bottom : 0;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#C9A84C" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <View style={styles.headerAvatar}>
                        <Icon name="account" size={18} color="#C9A84C" />
                    </View>
                    <View>
                        <Text style={styles.headerName}>{otherName}</Text>
                        <Text style={styles.headerStatus}>Online</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.callBtn}>
                    <Icon name="phone" size={18} color="#10b981" />
                </TouchableOpacity>
            </View>

            {/* Main content area — padded up by keyboard height on Android */}
            <View style={[styles.body, { paddingBottom: keyboardHeight + bottomOffset }]}>
                {/* Messages */}
                <View style={styles.listWrap}>
                    <FlatList
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={8}
                        windowSize={5}
                        initialNumToRender={8}
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(m) => m.id}
                        renderItem={renderMessage}
                        contentContainerStyle={messages.length ? styles.messagesList : styles.messagesEmpty}
                        onContentSizeChange={() => {
                            try { flatListRef.current?.scrollToEnd({ animated: false }); } catch {}
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <Icon name="chat-outline" size={40} color="#d1d5db" />
                                <Text style={styles.emptyText}>No messages yet</Text>
                                <Text style={styles.emptySubtext}>Send a message or use quick replies below</Text>
                            </View>
                        }
                    />
                </View>

                {/* Quick replies */}
                <View style={styles.quickReplyWrap}>
                    <FlatList
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={8}
                        windowSize={5}
                        initialNumToRender={8}
                        data={quickReplies}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(_, i) => String(i)}
                        contentContainerStyle={styles.quickReplyList}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.quickReplyChip} onPress={() => sendMessage(item)}>
                                <Text style={styles.quickReplyText}>{item}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {/* Input row */}
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Type a message"
                        placeholderTextColor="#444444"
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
                    >
                        <Icon name="send" size={20} color="#ffffff" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: G.bgAlt,
    },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 10, backgroundColor: G.bg,
        borderBottomWidth: 1, borderBottomColor: G.border3,
    },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center' },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: G.glass2, alignItems: 'center', justifyContent: 'center',
    },
    headerName: { fontSize: 14, fontWeight: '800', color: G.textPrimary },
    headerStatus: { fontSize: 11, color: '#10b981', fontWeight: '600' },
    callBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: G.glass2,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#bbf7d0',
    },

    body: { flex: 1 },
    listWrap: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
    messagesList: { paddingBottom: 12, gap: 8 },
    messagesEmpty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },

    msgRow: { marginBottom: 8, alignItems: 'flex-start' },
    msgRowMe: { alignItems: 'flex-end' },
    msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 10, paddingHorizontal: 14 },
    msgBubbleMe: { backgroundColor: G.accent, borderBottomRightRadius: 4 },
    msgBubbleOther: { backgroundColor: G.bg, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: G.border3 },
    msgText: { fontSize: 14, color: '#CCCCCC', fontWeight: '500', lineHeight: 20 },
    msgTextMe: { color: G.textPrimary },
    msgTime: { fontSize: 10, color: G.textMuted, marginTop: 4, textAlign: 'right' },
    msgTimeMe: { color: '#bfdbfe' },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
    emptyText: { fontSize: 15, fontWeight: '700', color: G.textSecondary },
    emptySubtext: { fontSize: 12, color: G.textMuted },

    quickReplyWrap: { borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: G.bg },
    quickReplyList: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
    quickReplyChip: {
        backgroundColor: G.glass2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
        borderWidth: 1, borderColor: '#bfdbfe', marginRight: 6,
    },
    quickReplyText: { fontSize: 12, fontWeight: '600', color: G.accent },

    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
        paddingHorizontal: 12, paddingVertical: 10, backgroundColor: G.bg,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)',
    },
    input: {
        flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: G.glass2, borderRadius: 14,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '700',
        color: G.textPrimary,
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 14, backgroundColor: G.accent,
        alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
});

export default InAppChatScreen;
