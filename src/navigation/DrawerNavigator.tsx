import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from '@react-navigation/drawer';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '../redux/store';
import { logout } from '../redux/slices/authSlice';
import MainNavigator from './MainNavigator';
import AdminNavigator from './AdminNavigator';

import NotificationsScreen from '../screens/common/NotificationsScreen';
import SupportScreen from '../screens/common/SupportScreen';
import ReferralScreen from '../screens/common/ReferralScreen';
import SettingsScreen from '../screens/common/SettingsScreen';
import LanguageSelectionScreen from '../screens/common/LanguageSelectionScreen';

const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props: any) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerScroll}>
      <View style={styles.drawerHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || 'U'}</Text>
        </View>
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
          icon={({ color, size }) => <Icon name="logout" color={color} size={size} />}
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
          <Icon name="chevron-left" size={22} color="#6b7280" />
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
};

const DrawerNavigator = () => {
  const { user, roleOverride } = useAppSelector((s) => s.auth);

  const isAdmin = (() => {
    const phone = String((user as any)?.phoneNumber || '');
    const digits = phone.replace(/\D/g, '');
    const last10 = digits.length > 10 ? digits.slice(-10) : digits;
    return last10 === '6304767391';
  })();

  return (
    <Drawer.Navigator
      key={`drawer-${user?.userType ?? 'NONE'}-${roleOverride ?? 'NO_OVERRIDE'}`}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: '#2563eb',
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
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerLabel: 'Settings',
          drawerIcon: ({ color, size }) => <Icon name="cog" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="Language"
        component={LanguageSelectionScreen}
        options={{
          drawerLabel: 'Language',
          drawerIcon: ({ color, size }) => <Icon name="translate" color={color} size={size} />,
        }}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerScroll: {
    flex: 1,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
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
    color: '#111827',
  },
  userPhone: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  modeToggleRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  drawerList: {
    flex: 1,
    paddingTop: 8,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
    color: '#6b7280',
    fontWeight: '600',
  },
});

export default DrawerNavigator;
