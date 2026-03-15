import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { clearNotifications, removeNotification } from '../../redux/slices/notificationSlice';

const NotificationsScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.notification.items);

  const renderIcon = (type: string) => {
    if (type === 'error') return <Icon name="alert-circle" size={18} color="#991b1b" />;
    if (type === 'warning') return <Icon name="alert" size={18} color="#92400e" />;
    if (type === 'success') return <Icon name="check-circle" size={18} color="#166534" />;
    if (type === 'booking_request') return <Icon name="car" size={18} color="#1e40af" />;
    if (type === 'support_chat') return <Icon name="headset" size={18} color="#1e40af" />;
    return <Icon name="information" size={18} color="#C9A84C" />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Icon name="bell" size={22} color="#C9A84C" />
          <Text style={styles.title}>Notifications</Text>
        </View>
        <TouchableOpacity
          style={[styles.clearBtn, items.length === 0 ? styles.clearBtnDisabled : null]}
          disabled={items.length === 0}
          onPress={() => dispatch(clearNotifications())}
        >
          <Text style={[styles.clearText, items.length === 0 ? styles.clearTextDisabled : null]}>Clear</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.cardTitle}>No notifications</Text>
          <Text style={styles.cardSub}>You’ll see booking updates, offers, and important alerts here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.item}
              onPress={() => {
                try {
                  if (item.type === 'support_chat' && item.bookingId) {
                    navigation.navigate('SupportChat', {
                      bookingId: item.bookingId,
                      threadUserId: item.supportThreadUserId,
                    });
                  }
                } catch {
                }
                dispatch(removeNotification(item.id));
              }}
            >
              <View style={styles.itemIcon}>{renderIcon(item.type)}</View>
              <View style={styles.itemBody}>
                <Text style={styles.itemMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  headerRow: {
    padding: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
  },
  clearBtnDisabled: {
    backgroundColor: '#1E1E1E',
  },
  clearText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  clearTextDisabled: {
    color: '#8A8A8A',
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardSub: {
    marginTop: 6,
    fontSize: 13,
    color: '#8A8A8A',
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  item: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemMessage: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  itemMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#8A8A8A',
  },
});

export default NotificationsScreen;
