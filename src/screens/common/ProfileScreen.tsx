import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { clearRoleOverride, logout, setRoleOverride } from '../../redux/slices/authSlice';
import { getActiveBooking, goOffline } from '../../services/api';
import { BookingStatus, UserType } from '../../types';
import { setDriverOnline } from '../../redux/slices/driverSlice';
import { ScaleIn, SlideUp, PressableScale } from '../../components/premium/AnimatedComponents';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const ProfileScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const { user, roleOverride } = useAppSelector((state) => state.auth);
  const isOnline = useAppSelector((state) => state.driver.isOnline);
  const currentBooking = useAppSelector((state) => state.booking.currentBooking);

  const ratingNumber = (() => {
    const raw = (user as any)?.rating;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  })();

  const totalRatingsNumber = (() => {
    const raw = (user as any)?.totalRatings;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  })();

  const isDriver = user?.userType === UserType.DRIVER || user?.userType === UserType.BOTH;

  const isActiveTripStatus = (status: any) => {
    return [
      BookingStatus.REQUESTED,
      BookingStatus.SEARCHING,
      BookingStatus.ACCEPTED,
      BookingStatus.DRIVER_ARRIVING,
      BookingStatus.ARRIVED,
      BookingStatus.STARTED,
      BookingStatus.IN_PROGRESS,
    ].includes(status);
  };

  const hasActiveTrip = Boolean(
    currentBooking?.id &&
    currentBooking?.status &&
    [
      BookingStatus.REQUESTED,
      BookingStatus.SEARCHING,
      BookingStatus.ACCEPTED,
      BookingStatus.DRIVER_ARRIVING,
      BookingStatus.ARRIVED,
      BookingStatus.STARTED,
      BookingStatus.IN_PROGRESS,
    ].includes(currentBooking.status as any)
  );

  const isCustomerMode = isDriver && roleOverride === UserType.CUSTOMER;
  const canEnableCustomerMode = isDriver && !isOnline && !hasActiveTrip;

  const ensureBackendAllowsCustomerMode = async (): Promise<boolean> => {
    try {
      const raw = await getActiveBooking();
      const status = (raw as any)?.status;
      if (raw && (raw as any)?.id && isActiveTripStatus(status)) {
        return false;
      }
      return true;
    } catch {
      return !hasActiveTrip;
    }
  };

  const toggleCustomerMode = async (nextValue: boolean) => {
    if (!isDriver) return;
    const navigateToTab = (tabName: string) => {
      try {
        const parent = typeof navigation?.getParent === 'function' ? navigation.getParent() : null;
        if (parent && typeof parent.navigate === 'function') { parent.navigate('Tabs', { screen: tabName }); return; }
      } catch {}
      try { navigation.navigate(tabName); } catch {}
    };
    if (nextValue) {
      if (hasActiveTrip) { showAlert('Cannot switch mode', 'An active booking is assigned.'); return; }
      // Optimistic: switch immediately, verify in background
      dispatch(setRoleOverride(UserType.CUSTOMER));
      dispatch(setDriverOnline(false));
      navigateToTab('Home');
      // Background verification
      void (async () => {
        try { await goOffline(); } catch {}
        try {
          const ok = await ensureBackendAllowsCustomerMode();
          if (!ok) { dispatch(clearRoleOverride()); showAlert('Cannot switch mode', 'Active booking found. Reverting.'); }
        } catch {}
      })();
    } else {
      dispatch(clearRoleOverride());
      navigateToTab('Accept');
    }
  };

  const handleLogout = () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <ScrollView>
        <ScaleIn delay={100}>
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              {user?.profileImage ? (
                <Image source={{ uri: String(user.profileImage) }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {user?.firstName?.charAt(0)}
                  {user?.lastName?.charAt(0)}
                </Text>
              )}
            </View>
            <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.phone}>{user?.phoneNumber}</Text>
            {user?.email && <Text style={styles.email}>{user.email}</Text>}
            {isDriver ? (
              <View style={styles.ratingContainer}>
                <Icon name="star" size={16} color="#f59e0b" />
                <Text style={styles.rating}>{ratingNumber !== null ? ratingNumber.toFixed(1) : '0.0'}</Text>
                <Text style={styles.ratingCount}>({totalRatingsNumber} ratings)</Text>
              </View>
            ) : null}
          </View>
        </ScaleIn>

        {isDriver ? (
          <View style={styles.section}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.modeRow, !isCustomerMode && !canEnableCustomerMode ? styles.modeRowDisabled : null]}
              onPress={() => {
                if (!isCustomerMode && !canEnableCustomerMode) {
                  if (hasActiveTrip) {
                    showAlert('Cannot switch mode', 'An active booking is assigned. Please complete/cancel it first.');
                    return;
                  }
                  if (isOnline) {
                    showAlert('Go offline first', 'Please set yourself OFFLINE before enabling Customer mode.');
                    return;
                  }
                  showAlert('Cannot switch mode', 'Please go offline and ensure no active booking is assigned.');
                  return;
                }

                void toggleCustomerMode(!isCustomerMode);
              }}
            >
              <View style={styles.menuItemLeft}>
                <Icon
                  name={isCustomerMode ? 'account' : 'account-switch'}
                  size={24}
                  color={!isCustomerMode && !canEnableCustomerMode ? '#9ca3af' : '#6b7280'}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.menuItemText}>{isCustomerMode ? 'Go to driver mode' : 'Customer mode'}</Text>
                  <Text style={styles.modeHint} numberOfLines={2}>
                    {hasActiveTrip
                      ? 'Finish or cancel the active booking to enable'
                      : isOnline
                        ? 'Go offline to enable'
                        : isCustomerMode
                          ? 'Tap to return to driver mode'
                          : 'Use customer screens while you are offline'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isCustomerMode}
                disabled={!isCustomerMode && !canEnableCustomerMode}
                onValueChange={(v) => {
                  void toggleCustomerMode(Boolean(v));
                }}
                trackColor={{ false: '#333333', true: '#C9A84C' }}
                thumbColor="#ffffff"
              />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <MenuItem icon="account-edit" title="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />
          {(!isDriver || isCustomerMode) && (
            <>
              <MenuItem icon="wallet" title="Wallet" onPress={() => navigation.navigate('CustomerWallet')} />
              <MenuItem icon="crown" title="Membership" onPress={() => navigation.navigate('Membership')} />
              <MenuItem icon="fire" title="Streak Bonuses" onPress={() => navigation.navigate('StreakBonus')} />
              <MenuItem icon="map-marker" title="Saved Addresses" onPress={() => navigation.navigate('SavedAddresses')} />
              <MenuItem icon="ticket-percent" title="Promo Codes" onPress={() => navigation.navigate('PromoCodes')} />
              <MenuItem icon="heart" title="Favorite Drivers" onPress={() => navigation.navigate('FavoriteDrivers')} />
            </>
          )}
          {(isDriver && !isCustomerMode) && (
            <>
              <MenuItem icon="wallet" title="Wallet" onPress={() => navigation.navigate('DriverWallet')} />
              <MenuItem icon="shield-star" title="🏅 Skill Badges" onPress={() => navigation.navigate('DriverBadges')} />
            </>
          )}
          {(!isDriver || isCustomerMode) && (
            <MenuItem icon="star-circle" title="Rewards" onPress={() => navigation.navigate('Rewards')} />
          )}
          <MenuItem icon="gift" title="Refer & Earn" onPress={() => navigation.navigate('Referral')} />
        </View>

        <View style={styles.section}>
          <MenuItem icon="shield-check" title="Safety" onPress={() => navigation.navigate('Safety')} />
          <MenuItem icon="phone-alert" title="Emergency Contacts" onPress={() => navigation.navigate('EmergencyContacts')} />
          <MenuItem
            icon="headphones"
            title="Help & Support"
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <MenuItem icon="file-document" title="Terms & Conditions" onPress={() => navigation.navigate('Terms')} />
          <MenuItem icon="shield-lock" title="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const MenuItem = ({
  icon,
  title,
  onPress,
}: {
  icon: any;
  title: string;
  onPress?: () => void;
}) => (
  <PressableScale onPress={onPress} style={styles.menuItem} scaleTo={0.98}>
    <View style={styles.menuItemLeft}>
      <Icon name={icon} size={24} color="#C9A84C" />
      <Text style={styles.menuItemText}>{title}</Text>
    </View>
    <Icon name="chevron-right" size={24} color="#555555" />
  </PressableScale>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bg,
  },
  header: {
    backgroundColor: G.glass3,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: G.borderAccent,
    shadowColor: G.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarContainer: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: G.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: G.borderAccent,
  },
  avatarImage: {
    width: 86,
    height: 86,
  },
  avatarText: {
    color: G.accent,
    fontSize: 30,
    fontWeight: '800',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: G.textPrimary,
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: G.textSecondary,
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: G.textSecondary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
    backgroundColor: G.warningSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  rating: {
    fontSize: 15,
    fontWeight: '700',
    color: G.textPrimary,
  },
  ratingCount: {
    fontSize: 13,
    color: G.textSecondary,
  },
  section: {
    backgroundColor: G.glass2,
    marginTop: 14,
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: G.border2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: G.border1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: G.textPrimary,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: G.border1,
    gap: 12,
  },
  modeRowDisabled: {
    opacity: 0.5,
  },
  modeHint: {
    marginTop: 3,
    fontSize: 12,
    color: G.textSecondary,
    fontWeight: '500',
    lineHeight: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
    paddingVertical: 15,
    backgroundColor: G.errorSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: G.error,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: G.textMuted,
    marginTop: 12,
    marginBottom: 28,
  },
});

export default ProfileScreen;
