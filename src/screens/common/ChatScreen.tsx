import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import socketService from '../../services/socketService';
import { useAppSelector } from '../../redux/store';

type ChatMessage = {
  id: string;
  bookingId: string;
  senderId: string | null;
  message: string;
  timestamp: string;
};

const buildId = (m: Pick<ChatMessage, 'senderId' | 'timestamp' | 'message'>) => {
  return `${m.senderId ?? 'unknown'}-${m.timestamp}-${m.message.slice(0, 12)}`;
};

const toIso = (v: unknown) => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof v === 'number') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
};

const ChatScreen = ({ navigation, route }: any) => {
  const bookingId = String(route?.params?.bookingId ?? '');
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);

  const [text, setText] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const canSend = useMemo(() => {
    return Boolean(bookingId) && text.trim().length > 0;
  }, [bookingId, text]);

  useEffect(() => {
    let active = true;

    const onMessage = (payload: any) => {
      if (!active) return;
      const incomingBookingId = String(payload?.bookingId ?? bookingId ?? '');
      if (!incomingBookingId || incomingBookingId !== bookingId) return;

      const incomingSenderId = typeof payload?.senderId === 'string' ? payload.senderId : null;
      const incomingClientId = typeof payload?.clientMessageId === 'string' ? payload.clientMessageId : null;
      if (userId && incomingSenderId && String(incomingSenderId) === String(userId) && !incomingClientId) {
        return;
      }

      const stableId = incomingClientId
        ? incomingClientId
        : buildId({
            senderId: incomingSenderId,
            timestamp: toIso(payload?.timestamp),
            message: String(payload?.message ?? ''),
          });

      const msg: ChatMessage = {
        id: stableId,
        bookingId: incomingBookingId,
        senderId: incomingSenderId,
        message: String(payload?.message ?? ''),
        timestamp: toIso(payload?.timestamp),
      };

      if (!msg.message) return;

      setMessages((prev) => {
        if (prev.some((p) => p.id === msg.id)) return prev;
        return [...prev, msg].slice(-200);
      });
    };

    const start = async () => {
      if (!bookingId) return;
      try {
        await socketService.connect();
        if (!active) return;
        socketService.joinBooking(bookingId);
        socketService.on('chat:message', onMessage);
      } catch {
      }
    };

    start();

    return () => {
      active = false;
      try {
        socketService.off('chat:message', onMessage);
        if (bookingId) socketService.leaveBooking(bookingId);
      } catch {
      }
    };
  }, [bookingId]);

  const send = useCallback(async () => {
    const msg = text.trim();
    if (!bookingId || !msg) return;

    const clientMessageId = `${String(userId ?? 'unknown')}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const optimistic: ChatMessage = {
      id: clientMessageId,
      bookingId,
      senderId: userId,
      message: msg,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic].slice(-200));
    setText('');

    try {
      await socketService.connect();
      socketService.sendMessage(bookingId, msg, clientMessageId);
    } catch {
    }
  }, [bookingId, text, userId]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const mine = Boolean(userId && item.senderId && item.senderId === userId);
      return (
        <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextOther]}>{item.message}</Text>
            <Text style={[styles.timeText, { color: mine ? 'rgba(255,255,255,0.85)' : '#6b7280' }]}>
              {new Date(item.timestamp).toLocaleTimeString().slice(0, 5)}
            </Text>
          </View>
        </View>
      );
    },
    [userId]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Chat
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 76 : 0}
      >
        <View style={styles.listWrap}>
          <FlatList
            ref={(r) => {
              listRef.current = r;
            }}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={messages.length ? styles.messages : styles.messagesEmpty}
            ListEmptyComponent={<Text style={styles.emptyText}>Say hi to start the conversation.</Text>}
            onContentSizeChange={() => {
              try {
                listRef.current?.scrollToEnd({ animated: true });
              } catch {
              }
            }}
          />
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            multiline
          />
          <TouchableOpacity
            onPress={send}
            disabled={!canSend}
            style={[styles.sendBtn, { opacity: canSend ? 1 : 0.5 }]}
          >
            <Icon name="send" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
    padding: 12,
  },
  messages: {
    paddingBottom: 10,
    gap: 10,
  },
  messagesEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: '#2563eb',
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 18,
  },
  bubbleTextMine: {
    color: '#ffffff',
    fontWeight: '600',
  },
  bubbleTextOther: {
    color: '#111827',
    fontWeight: '600',
  },
  timeText: {
    marginTop: 4,
    fontSize: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;
