import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from '@react-navigation/drawer';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

// Safe fallback: LinearGradient needs a dev build with expo-linear-gradient native module
let LinearGradient: any;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  // Fallback: use a plain View with gold background
  LinearGradient = ({ style, children, ...rest }: any) => {
    const { View } = require('react-native');
    return <View style={[style, { backgroundColor: '#C9A84C' }]}>{children}</View>;
  };
}

import { useAppDispatch, useAppSelector } from '../redux/store';
import { logout } from '../redux/slices/authSlice';
import MainNavigator from './MainNavigator';
import AdminNavigator from './AdminNavigator';
import { isAdminPhone } from '../constants/adminConfig';

import NotificationsScreen from '../screens/common/NotificationsScreen';
import SupportScreen from '../screens/common/SupportScreen';
import ReferralScreen from '../screens/common/ReferralScreen';

import { colors, drawerTheme, goldGradient } from '../theme';

const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props: any) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerScroll}>
      <View style={styles.drawerHeader}>
        {/* Gold ring avatar */}
        <LinearGradient
          colors={goldGradient as any}
          style={styles.avatarRing}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || 'U'}</Text>
          </View>
        </LinearGradient>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userPhone} numberOfLines={1}>
            {user?.phoneNumber}
          </Text>
        </View>
      </View>

      <View style={styles.drawerList}>
        <DrawerItemList {...props} />
      </View>

      <View style={styles.drawerFooter}>
        <DrawerItem
          label="Logout"
          labelStyle={{ color: colors.error }}
          icon={({ size }) => <Icon name="logout" color={colors.error} size={size} />}
          onPress={() => {
            dispatch(logout());
          }}
        />

        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            props.navigation.closeDrawer();
          }}
        >
          <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
};

const DrawerNavigator = () => {
  const { user, roleOverride } = useAppSelector((s) => s.auth);

  const isAdmin = isAdminPhone(String((user as any)?.phoneNumber || ''));

  return (
    <Drawer.Navigator
      key={`drawer-${user?.userType ?? 'NONE'}-${roleOverride ?? 'NO_OVERRIDE'}`}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: drawerTheme.activeTint,
        drawerInactiveTintColor: drawerTheme.inactiveTint,
        drawerActiveBackgroundColor: drawerTheme.activeBackground,
        drawerStyle: { backgroundColor: drawerTheme.background },
        drawerLabelStyle: { fontWeight: '700' },
        swipeEnabled: false,
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen
        name="MainTabs"
        component={MainNavigator}
        options={{
          drawerLabel: 'Home',
          drawerIcon: ({ color, size }) => <Icon name="home" color={color} size={size} />,
        }}
      />
      {isAdmin ? (
        <>
          <Drawer.Screen
            name="AdminNeedHelp"
            component={AdminNavigator}
            initialParams={{ initialRouteName: 'AdminNeedHelp' }}
            options={{
              drawerLabel: 'Need Help',
              drawerIcon: ({ color, size }) => <Icon name="headset" color={color} size={size} />,
            }}
          />
          <Drawer.Screen
            name="AdminVerifications"
            component={AdminNavigator}
            initialParams={{ initialRouteName: 'AdminDriverVerifications' }}
            options={{
              drawerLabel: 'Verifications',
              drawerIcon: ({ color, size }) => <Icon name="shield-account" color={color} size={size} />,
            }}
          />
          <Drawer.Screen
            name="AdminRefunds"
            component={AdminNavigator}
            initialParams={{ initialRouteName: 'AdminRefunds' }}
            options={{
              drawerLabel: 'Refunds',
              drawerIcon: ({ color, size }) => <Icon name="cash-refund" color={color} size={size} />,
            }}
          />
        </>
      ) : null}
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          drawerLabel: 'Notifications',
          drawerIcon: ({ color, size }) => <Icon name="bell" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="Support"
        component={SupportScreen}
        options={{
          drawerLabel: 'Support',
          drawerIcon: ({ color, size }) => <Icon name="headset" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="Referral"
        component={ReferralScreen}
        options={{
          drawerLabel: 'Referral',
          drawerIcon: ({ color, size }) => <Icon name="ticket-percent" color={color} size={size} />,
        }}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerScroll: {
    flex: 1,
    backgroundColor: drawerTheme.background,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: drawerTheme.separator,
  },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '800',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userPhone: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  drawerList: {
    flex: 1,
    paddingTop: 8,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: drawerTheme.separator,
    paddingBottom: 8,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeText: {
    marginLeft: 6,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default DrawerNavigator;
