import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { addChatMessage } from '../../redux/slices/bookingSlice';
import { G } from '../../constants/glassStyles';

type ChatMessage = {
  id: string;
  bookingId: string;
  senderId: string | null;
  message: string;
  timestamp: string;
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
  const dispatch = useAppDispatch();

  // Read messages from Redux — persists across screen navigations
  const EMPTY: ChatMessage[] = useMemo(() => [], []);
  const stored = useAppSelector((s) => s.booking.chatMessages[bookingId]);
  const messages = (stored ?? EMPTY) as ChatMessage[];

  const [text, setText] = React.useState<string>('');
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const canSend = useMemo(() => {
    return Boolean(bookingId) && text.trim().length > 0;
  }, [bookingId, text]);

  // Connect socket, join booking room, and listen for messages
  useEffect(() => {
    if (!bookingId) return;
    let active = true;

    const onMessage = (payload: any) => {
      if (!active) return;
      const incomingBookingId = String(payload?.bookingId ?? '');
      if (incomingBookingId !== bookingId) return;

      const incomingSenderId = typeof payload?.senderId === 'string' ? payload.senderId : null;
      const incomingClientId = typeof payload?.clientMessageId === 'string' ? payload.clientMessageId : null;
      const msgText = String(payload?.message ?? '');
      if (!msgText) return;

      const ts = toIso(payload?.timestamp);
      const stableId = incomingClientId
        ? incomingClientId
        : `${incomingSenderId ?? 'unknown'}-${ts}-${msgText.slice(0, 12)}`;

      dispatch(
        addChatMessage({
          bookingId,
          id: stableId,
          senderId: incomingSenderId,
          message: msgText,
          timestamp: ts,
        })
      );
    };

    const start = async () => {
      try {
        await socketService.connect();
        if (!active) return;
        socketService.joinBooking(bookingId);
        socketService.on('chat:message', onMessage);
      } catch {}
    };

    start();

    return () => {
      active = false;
      try {
        socketService.off('chat:message', onMessage);
        // NOTE: Do NOT call leaveBooking here — TrackingScreen still needs the room
      } catch {}
    };
  }, [bookingId, dispatch]);

  const send = useCallback(async () => {
    const msg = text.trim();
    if (!bookingId || !msg) return;

    const clientMessageId = `${String(userId ?? 'unknown')}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Add optimistic message to Redux
    dispatch(
      addChatMessage({
        bookingId,
        id: clientMessageId,
        senderId: userId,
        message: msg,
        timestamp: new Date().toISOString(),
      })
    );
    setText('');

    try {
      await socketService.connect();
      socketService.sendMessage(bookingId, msg, clientMessageId);
    } catch {
    }
  }, [bookingId, text, userId, dispatch]);

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
          <Icon name="arrow-left" size={22} color="#C9A84C" />
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
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
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
            placeholderTextColor="#444444"
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
    backgroundColor: G.bgAlt,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: G.bg,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
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
    color: G.textPrimary,
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
    color: G.textSecondary,
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
    backgroundColor: G.accent,
  },
  bubbleOther: {
    backgroundColor: G.bg,
    borderWidth: 1,
    borderColor: G.border3,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 18,
  },
  bubbleTextMine: {
    color: G.textPrimary,
    fontWeight: '600',
  },
  bubbleTextOther: {
    color: G.textPrimary,
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
    borderTopColor: 'rgba(255,255,255,0.3)',
    backgroundColor: G.bg,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: G.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: G.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;
