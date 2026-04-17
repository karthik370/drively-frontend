import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { removeNotification } from '../redux/slices/notificationSlice';
import { G } from '../constants/glassStyles';

const NotificationToast = () => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const latest = useAppSelector((s) => s.notification.items[0] ?? null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!latest?.id) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
    }, 3500);

    return () => clearTimeout(t);
  }, [latest?.id]);

  const theme = useMemo(() => {
    const type = latest?.type;
    if (type === 'error') return { bg: '#fee2e2', fg: '#991b1b', icon: 'alert-circle' as const };
    if (type === 'warning') return { bg: '#fef3c7', fg: '#92400e', icon: 'alert' as const };
    if (type === 'success') return { bg: '#dcfce7', fg: '#166534', icon: 'check-circle' as const };
    if (type === 'booking_request') return { bg: '#dbeafe', fg: '#1e40af', icon: 'car' as const };
    if (type === 'support_chat') return { bg: '#dbeafe', fg: '#1e40af', icon: 'headset' as const };
    return { bg: '#e5e7eb', fg: '#111827', icon: 'information' as const };
  }, [latest?.type]);

  if (!latest || !visible) {
    return null;
  }

  return (
    <View style={[styles.wrap, { top: insets.top + 10 }]} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.toast, { backgroundColor: theme.bg }]}
        onPress={() => {
          dispatch(removeNotification(latest.id));
          setVisible(false);
        }}
      >
        <Icon name={theme.icon} size={18} color={theme.fg} />
        <Text style={[styles.text, { color: theme.fg }]} numberOfLines={2}>
          {latest.message}
        </Text>
        <Icon name="close" size={18} color={theme.fg} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default NotificationToast;
