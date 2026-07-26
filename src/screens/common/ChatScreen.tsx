import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

// ── Quick-reply chips (Uber / Rapido / Ola style) ─────────────────────────────
const QUICK_REPLIES: Record<string, { icon: string; text: string }[]> = {
  customer: [
    { icon: '📍', text: 'Where are you?' },
    { icon: '🚪', text: "I'm at the gate" },
    { icon: '🏢', text: "I'm at the main entrance" },
    { icon: '⏱️', text: "I'll be there in 2 mins" },
    { icon: '🙏', text: 'Please hurry' },
    { icon: '📞', text: 'Please call me' },
    { icon: '🅿️', text: 'Can you come to parking?' },
    { icon: '✅', text: 'I can see you' },
    { icon: '🔄', text: "I'm on my way down" },
    { icon: '❓', text: 'Which car are you in?' },
  ],
  driver: [
    { icon: '✅', text: 'I have arrived' },
    { icon: '🚗', text: "I'm on my way" },
    { icon: '📍', text: "Can't find the location" },
    { icon: '⏳', text: 'Please wait 2 mins' },
    { icon: '🗺️', text: 'Please share exact pin' },
    { icon: '📞', text: 'Please call me' },
    { icon: '🅿️', text: "I'm in the parking area" },
    { icon: '👀', text: "I'm outside, look for me" },
    { icon: '🚦', text: 'Stuck in traffic, coming' },
    { icon: '🏁', text: 'Starting your trip now' },
  ],
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
  const userType: 'customer' | 'driver' = route?.params?.userType || 'customer';
  const otherName: string =
    route?.params?.otherName || (userType === 'customer' ? 'Driver' : 'Customer');

  const userId = useAppSelector((s) => s.auth.user?.id ?? null);
  const dispatch = useAppDispatch();

  const EMPTY: ChatMessage[] = useMemo(() => [], []);
  const stored = useAppSelector((s) => s.booking.chatMessages[bookingId]);
  const messages = (stored ?? EMPTY) as ChatMessage[];

  const [text, setText] = useState<string>('');
  // Track used chip indexes — hide after tapping to prevent re-sending same message
  const [usedChips, setUsedChips] = useState<Set<number>>(new Set());
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const quickReplies = QUICK_REPLIES[userType] ?? QUICK_REPLIES.customer;

  const canSend = useMemo(() => {
    return Boolean(bookingId) && text.trim().length > 0;
  }, [bookingId, text]);

  // ── Socket: connect, join room, listen ──────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    let active = true;

    const onMessage = (payload: any) => {
      if (!active) return;
      const incomingBookingId = String(payload?.bookingId ?? '');
      if (incomingBookingId !== bookingId) return;

      const incomingSenderId =
        typeof payload?.senderId === 'string' ? payload.senderId : null;
      const incomingClientId =
        typeof payload?.clientMessageId === 'string' ? payload.clientMessageId : null;
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

  // ── Send ─────────────────────────────────────────────────────────────────────
  const send = useCallback(
    async (overrideText?: string) => {
      const msg = (overrideText ?? text).trim();
      if (!bookingId || !msg) return;

      const clientMessageId = `${String(userId ?? 'unknown')}-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

      dispatch(
        addChatMessage({
          bookingId,
          id: clientMessageId,
          senderId: userId,
          message: msg,
          timestamp: new Date().toISOString(),
        })
      );
      if (!overrideText) setText('');

      try {
        await socketService.connect();
        socketService.sendMessage(bookingId, msg, clientMessageId);
      } catch {}
    },
    [bookingId, text, userId, dispatch]
  );

  const sendQuickReply = useCallback(
    (chipText: string, index: number) => {
      send(chipText);
      setUsedChips((prev) => new Set(prev).add(index));
    },
    [send]
  );

  // ── Render message ────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const mine = Boolean(userId && item.senderId && item.senderId === userId);
      const timeStr = (() => {
        try {
          return new Date(item.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
        } catch {
          return '';
        }
      })();
      return (
        <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
          {!mine && (
            <View style={styles.avatarDot}>
              <Icon
                name={userType === 'customer' ? 'car' : 'account'}
                size={12}
                color="#C9A84C"
              />
            </View>
          )}
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
              {item.message}
            </Text>
            <Text
              style={[
                styles.timeText,
                { color: mine ? 'rgba(0,0,0,0.45)' : '#6b7280', textAlign: 'right' },
              ]}
            >
              {timeStr}
            </Text>
          </View>
        </View>
      );
    },
    [userId, userType]
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Icon
              name={userType === 'customer' ? 'car' : 'account-circle'}
              size={18}
              color="#C9A84C"
            />
          </View>
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {otherName}
            </Text>
            <View style={styles.activeDot}>
              <View style={styles.greenDot} />
              <Text style={styles.headerSub}>Active trip</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* ── Safety banner ── */}
      <View style={styles.safetyBanner}>
        <Icon name="shield-check" size={12} color="#C9A84C" />
        <Text style={styles.safetyText}>Messages are only visible during this trip</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 76 : 0}
      >
        {/* ── Messages ── */}
        <View style={styles.listWrap}>
          <FlatList
            removeClippedSubviews
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
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Icon name="chat-outline" size={48} color="#333" />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySub}>Tap a quick reply or type a message</Text>
              </View>
            }
            onContentSizeChange={() => {
              try {
                listRef.current?.scrollToEnd({ animated: true });
              } catch {}
            }}
          />
        </View>

        {/* ── Bottom panel ── */}
        <View style={styles.bottomPanel}>
          {/* Quick-reply chips */}
          <View style={styles.quickReplySection}>
            <Text style={styles.quickReplyLabel}>Quick replies</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.quickReplyList}
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
                    <Text style={styles.chipText}>{qr.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`Message ${otherName}\u2026`}
              placeholderTextColor="#444"
              style={styles.input}
              multiline
            />
            <TouchableOpacity
              onPress={() => send()}
              disabled={!canSend}
              style={[styles.sendBtn, { opacity: canSend ? 1 : 0.4 }]}
            >
              <Icon name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bgAlt },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: G.bg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    height: 64,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,168,76,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  headerTitle: { fontSize: 14, fontWeight: '800', color: G.textPrimary },
  activeDot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  headerSub: { fontSize: 10, color: '#10b981', fontWeight: '600' },

  // Safety banner
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(201,168,76,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,0.1)',
  },
  safetyText: { fontSize: 11, color: '#888', flex: 1 },

  body: { flex: 1 },
  listWrap: { flex: 1, paddingHorizontal: 12, paddingTop: 10 },
  messages: { paddingBottom: 10, gap: 10 },
  messagesEmpty: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: G.textSecondary, marginTop: 8 },
  emptySub: {
    fontSize: 12,
    color: G.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Bubbles
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 2,
  },
  avatarDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(201,168,76,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: { backgroundColor: '#C9A84C', borderBottomRightRadius: 5 },
  bubbleOther: {
    backgroundColor: G.bg,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: '#0A0A0A', fontWeight: '600' },
  bubbleTextOther: { color: '#CCCCCC', fontWeight: '500' },
  timeText: { marginTop: 4, fontSize: 10 },

  // Bottom panel
  bottomPanel: {
    backgroundColor: G.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  quickReplySection: {
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  quickReplyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  quickReplyList: { paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
  quickReplyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: G.glass2,
    borderRadius: 22,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
    marginRight: 6,
  },
  chipEmoji: { fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#D4AF62' },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: G.bg,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: G.textPrimary,
    backgroundColor: G.glass2,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C9A84C',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default ChatScreen;
