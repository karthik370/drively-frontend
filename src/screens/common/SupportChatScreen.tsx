import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import socketService from '../../services/socketService';
import { useAppSelector } from '../../redux/store';
import { listSupportMessages, getBookingDetails } from '../../services/api';
import { G } from '../../constants/glassStyles';
import { isAdminPhone } from '../../constants/adminConfig';

type SupportMessage = {
  id: string;
  bookingId: string;
  threadUserId: string;
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

const SupportChatScreen = ({ navigation, route }: any) => {
  const bookingIdParam = String(route?.params?.bookingId ?? '');
  const threadUserIdParam = typeof route?.params?.threadUserId === 'string' ? route.params.threadUserId : '';
  const headerTitle = typeof route?.params?.title === 'string' && route.params.title
    ? route.params.title
    : 'Need Help';
  const user = useAppSelector((s) => s.auth.user as any);
  const currentBookingId = useAppSelector((s) => String((s.booking.currentBooking as any)?.id ?? ''));
  const userId = user?.id ?? null;

  const bookingId = bookingIdParam || currentBookingId;
  const isOnboarding = bookingId.startsWith('onboarding:');

  const [text, setText] = useState<string>('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  // resolvedThreadUserId: for admin without threadUserId param, auto-resolved from booking
  const [resolvedThreadUserId, setResolvedThreadUserId] = useState<string>('');
  const listRef = useRef<FlatList<SupportMessage> | null>(null);

  const isAdmin = useMemo(() => isAdminPhone(String(user?.phoneNumber || '')), [user?.phoneNumber]);

  const effectiveThreadUserId = useMemo(() => {
    if (isAdmin) return String(threadUserIdParam || resolvedThreadUserId || '');
    return String(userId || '');
  }, [isAdmin, threadUserIdParam, resolvedThreadUserId, userId]);

  // If admin and no threadUserId param, auto-resolve from booking
  useEffect(() => {
    if (!isAdmin) return;
    if (threadUserIdParam) return; // already have it
    if (!bookingId) return;
    let active = true;
    void (async () => {
      try {
        const b = await getBookingDetails(bookingId);
        const customerId = String((b as any)?.customer?.id || (b as any)?.customerId || '');
        if (active && customerId) setResolvedThreadUserId(customerId);
      } catch {}
    })();
    return () => { active = false; };
  }, [isAdmin, bookingId, threadUserIdParam]);

  const canSend = useMemo(() => {
    return Boolean(bookingId) && Boolean(effectiveThreadUserId) && text.trim().length > 0;
  }, [bookingId, effectiveThreadUserId, text]);

  // hydrate fn — called on mount and every time screen is focused
  const hydrate = useCallback(async () => {
    if (!bookingId) { setIsHydrating(false); return; }
    if (!effectiveThreadUserId) { setIsHydrating(false); return; }
    setIsHydrating(true);
    try {
      // Always pass threadUserId so backend query is fully explicit
      const items = await listSupportMessages(bookingId, effectiveThreadUserId);
      setMessages((Array.isArray(items) ? items : []).slice(-300));
      // Scroll to bottom after loading history
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {
    } finally {
      setIsHydrating(false);
    }
  }, [bookingId, effectiveThreadUserId]);

  // Initial load
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Re-hydrate every time the screen comes back into focus (e.g. user navigated away and returned)
  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate])
  );

  useEffect(() => {
    let active = true;

    const onMessage = (payload: any) => {
      if (!active) return;

      const incomingBookingId = String(payload?.bookingId ?? '');
      const incomingThreadUserId = String(payload?.threadUserId ?? '');
      if (!incomingBookingId || incomingBookingId !== bookingId) return;
      if (!incomingThreadUserId || incomingThreadUserId !== effectiveThreadUserId) return;

      const msg: SupportMessage = {
        id: String(payload?.clientMessageId ?? `${payload?.senderId ?? 'unknown'}-${toIso(payload?.timestamp)}-${String(payload?.message ?? '').slice(0, 12)}`),
        bookingId: incomingBookingId,
        threadUserId: incomingThreadUserId,
        senderId: typeof payload?.senderId === 'string' ? payload.senderId : null,
        message: String(payload?.message ?? ''),
        timestamp: toIso(payload?.timestamp),
      };

      if (!msg.message) return;

      setMessages((prev) => {
        if (prev.some((p) => p.id === msg.id)) return prev;
        return [...prev, msg].slice(-300);
      });
    };

    const start = async () => {
      if (!bookingId) return;
      if (!effectiveThreadUserId) return;

      try {
        await socketService.connect();
        if (!active) return;

        socketService.joinSupportChat(bookingId, isAdmin ? effectiveThreadUserId : undefined);
        socketService.on('support:message', onMessage);
      } catch {
      }
    };

    void start();

    return () => {
      active = false;
      try {
        socketService.off('support:message', onMessage);
        socketService.leaveSupportChat(bookingId, isAdmin ? effectiveThreadUserId : undefined);
      } catch {
      }
    };
  }, [bookingId, effectiveThreadUserId, isAdmin]);

  const send = useCallback(async () => {
    const msg = text.trim();
    if (!canSend) return;

    const clientMessageId = `${String(userId ?? 'unknown')}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const optimistic: SupportMessage = {
      id: clientMessageId,
      bookingId,
      threadUserId: effectiveThreadUserId,
      senderId: userId,
      message: msg,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic].slice(-300));
    setText('');
    Keyboard.dismiss();

    try {
      await socketService.connect();
      socketService.sendSupportMessage(bookingId, msg, clientMessageId, isAdmin ? effectiveThreadUserId : undefined);
    } catch {
    }
  }, [bookingId, canSend, effectiveThreadUserId, isAdmin, text, userId]);

  const renderItem = useCallback(
    ({ item }: { item: SupportMessage }) => {
      const mine = Boolean(userId && item.senderId && String(item.senderId) === String(userId));
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
    <SafeAreaView edges={['top','bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 76 : 0}
      >
        <View style={styles.listWrap}>
          {/* Onboarding context banner */}
          {isOnboarding && (
            <View style={styles.onboardingBanner}>
              <Icon name="shield-account" size={16} color="#C9A84C" style={{ marginRight: 8 }} />
              <Text style={styles.onboardingBannerText}>
                Verification support — our team will respond shortly
              </Text>
            </View>
          )}
          {isHydrating ? (
            <View style={styles.messagesEmpty}>
              <ActivityIndicator size="small" color="#C9A84C" />
              <Text style={[styles.emptyText, { marginTop: 10 }]}>Loading messages…</Text>
            </View>
          ) : (
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
              ListEmptyComponent={<Text style={styles.emptyText}>Send a message to our support team.</Text>}
              onContentSizeChange={() => {
                try {
                  listRef.current?.scrollToEnd({ animated: true });
                } catch {
                }
              }}
            />
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor="#444444"
            style={styles.input}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={() => { void send(); }}
          />
          <TouchableOpacity onPress={() => void send()} disabled={!canSend} style={[styles.sendBtn, { opacity: canSend ? 1 : 0.5 }]}>
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: G.bg,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: G.textPrimary,
  },
  body: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  messages: {
    paddingBottom: 12,
    gap: 8,
  },
  messagesEmpty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  emptyText: {
    color: G.textSecondary,
    fontWeight: '700',
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  bubbleMine: {
    backgroundColor: G.accent,
    borderTopRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: G.bg,
    borderWidth: 1,
    borderColor: G.border3,
    borderTopLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bubbleTextMine: {
    color: G.textPrimary,
  },
  bubbleTextOther: {
    color: G.textPrimary,
  },
  timeText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: G.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: G.glass2,
    color: G.textPrimary,
    fontWeight: '700',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: G.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201, 168, 76, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  onboardingBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#C9A84C',
    lineHeight: 18,
  },
});

export default SupportChatScreen;
