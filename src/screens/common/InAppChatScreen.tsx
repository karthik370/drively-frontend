import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import socketService from '../../services/socketService';

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

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const flatListRef = useRef<FlatList>(null);

    // Quick reply options
    const quickReplies = userType === 'customer'
        ? ['Where are you?', 'I\'m waiting at gate', 'Please come to basement parking', 'I\'ll be out in 5 mins']
        : ['On my way', 'Reached location', 'Please share exact pin', 'Will be there in 5 mins'];

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

    return (
        <SafeAreaView style={styles.container}>
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

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(m) => m.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messagesList}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Icon name="chat-outline" size={40} color="#d1d5db" />
                            <Text style={styles.emptyText}>No messages yet</Text>
                            <Text style={styles.emptySubtext}>Send a message or use quick replies below</Text>
                        </View>
                    }
                />

                {/* Quick replies */}
                <View style={styles.quickReplyWrap}>
                    <FlatList
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

                {/* Input */}
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Type a message..."
                        placeholderTextColor="#444444"
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                        onPress={() => sendMessage(input)}
                        disabled={!input.trim()}
                    >
                        <Icon name="send" size={18} color="#ffffff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111111' },

    header: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0A0A0A',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)',
    },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center' },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center',
    },
    headerName: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
    headerStatus: { fontSize: 11, color: '#10b981', fontWeight: '600' },
    callBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: '#141414',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#bbf7d0',
    },

    messagesList: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },

    msgRow: { marginBottom: 8, alignItems: 'flex-start' },
    msgRowMe: { alignItems: 'flex-end' },
    msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 10, paddingHorizontal: 14 },
    msgBubbleMe: { backgroundColor: '#C9A84C', borderBottomRightRadius: 4 },
    msgBubbleOther: { backgroundColor: '#0A0A0A', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    msgText: { fontSize: 14, color: '#CCCCCC', fontWeight: '500', lineHeight: 20 },
    msgTextMe: { color: '#ffffff' },
    msgTime: { fontSize: 10, color: '#666666', marginTop: 4, textAlign: 'right' },
    msgTimeMe: { color: '#bfdbfe' },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
    emptyText: { fontSize: 15, fontWeight: '700', color: '#8A8A8A' },
    emptySubtext: { fontSize: 12, color: '#666666' },

    quickReplyWrap: { borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#0A0A0A' },
    quickReplyList: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
    quickReplyChip: {
        backgroundColor: '#141414', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
        borderWidth: 1, borderColor: '#bfdbfe', marginRight: 6,
    },
    quickReplyText: { fontSize: 12, fontWeight: '600', color: '#C9A84C' },

    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 8,
        paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0A0A0A',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)',
    },
    input: {
        flex: 1, backgroundColor: '#141414', borderRadius: 20, paddingHorizontal: 16,
        paddingVertical: 10, fontSize: 14, fontWeight: '500', color: '#FFFFFF',
        maxHeight: 80,
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#C9A84C',
        alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#93c5fd' },
});

export default InAppChatScreen;
