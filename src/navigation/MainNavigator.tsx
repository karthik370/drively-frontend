import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../redux/store';
import { UserType } from '../types';
import { colors, tabBarTheme } from '../theme';

import HomeScreen from '../screens/customer/HomeScreen';
import BookingHistoryScreen from '../screens/customer/BookingHistoryScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import DriverOnlineScreen from '../screens/driver/DriverOnlineScreen';
import DriverEarningsScreen from '../screens/driver/DriverEarningsScreen';
import ScheduledBookingsScreen from '../screens/driver/ScheduledBookingsScreen';
import BookingDetailsScreen from '../screens/common/BookingDetailsScreen';
import TrackingScreen from '../screens/common/TrackingScreen';
import DriverBookingRequestDetailsScreen from '../screens/driver/DriverBookingRequestDetailsScreen';
import LocationSearchScreen from '../screens/customer/LocationSearchScreen';
import RideConfirmScreen from '../screens/customer/RideConfirmScreen';
import PromoCodesScreen from '../screens/customer/PromoCodesScreen';
import RewardsScreen from '../screens/customer/RewardsScreen';
import ReferralScreen from '../screens/common/ReferralScreen';
import DriverWalletScreen from '../screens/driver/DriverWalletScreen';

import SupportChatScreen from '../screens/common/SupportChatScreen';

import EditProfileScreen from '../screens/common/EditProfileScreen';
import SavedAddressesScreen from '../screens/common/SavedAddressesScreen';
import MapPickScreen from '../screens/common/MapPickScreen';
import SafetyScreen from '../screens/common/SafetyScreen';
import HelpSupportScreen from '../screens/common/HelpSupportScreen';
import TermsScreen from '../screens/common/TermsScreen';
import PrivacyPolicyScreen from '../screens/common/PrivacyPolicyScreen';
import EmergencyContactsScreen from '../screens/common/EmergencyContactsScreen';
import RideReceiptScreen from '../screens/common/RideReceiptScreen';
import FavoriteDriversScreen from '../screens/customer/FavoriteDriversScreen';
import StreakBonusScreen from '../screens/customer/StreakBonusScreen';
import PayoutSettingsScreen from '../screens/driver/PayoutSettingsScreen';
import AirportTransferScreen from '../screens/customer/AirportTransferScreen';
import DailyBookingScreen from '../screens/customer/DailyBookingScreen';
import InAppChatScreen from '../screens/common/InAppChatScreen';
import ChatScreen from '../screens/common/ChatScreen';
import DriverTiersScreen from '../screens/driver/DriverTiersScreen';
import HeatMapScreen from '../screens/driver/HeatMapScreen';
import TripPhotoScreen from '../screens/common/TripPhotoScreen';
import SharedTripScreen from '../screens/common/SharedTripScreen';
import DriverBadgesScreen from '../screens/driver/DriverBadgesScreen';

import CustomerWalletScreen from '../screens/customer/CustomerWalletScreen';
import WalletTopupScreen from '../screens/customer/WalletTopupScreen';
import WalletTransactionsScreen from '../screens/customer/WalletTransactionsScreen';
import MembershipScreen from '../screens/customer/MembershipScreen';
import TipDriverScreen from '../screens/customer/TipDriverScreen';

import DriverDocumentsSubmitScreen from '../screens/driver/DriverDocumentsSubmitScreen';
import DriverVerificationPendingScreen from '../screens/driver/DriverVerificationPendingScreen';
import DriverVerificationRejectedScreen from '../screens/driver/DriverVerificationRejectedScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const CustomerTabs = () => {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(8, insets.bottom);
  const height = 60 + Math.max(0, insets.bottom - 4);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabBarTheme.activeTintColor,
        tabBarInactiveTintColor: tabBarTheme.inactiveTintColor,
        lazy: true,
        freezeOnBlur: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          paddingBottom: bottom,
          paddingTop: 8,
          height,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingHistoryScreen}
        options={{
          tabBarLabel: 'My Rides',
          tabBarIcon: ({ color, size }) => (
            <Icon name="car-multiple" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const DriverTabs = () => {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(8, insets.bottom);
  const height = 60 + Math.max(0, insets.bottom - 4);

  return (
    <Tab.Navigator
      initialRouteName="Accept"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabBarTheme.activeTintColor,
        tabBarInactiveTintColor: tabBarTheme.inactiveTintColor,
        lazy: true,
        freezeOnBlur: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          paddingBottom: bottom,
          paddingTop: 8,
          height,
        },
      }}
    >
      <Tab.Screen
        name="Accept"
        component={DriverOnlineScreen}
        options={{
          tabBarLabel: 'Accept',
          tabBarIcon: ({ color, size }) => (
            <Icon name="radar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={DriverEarningsScreen}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ color, size }) => (
            <Icon name="cash-multiple" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={DriverWalletScreen}
        options={{
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Icon name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingHistoryScreen}
        options={{
          tabBarLabel: 'My Rides',
          tabBarIcon: ({ color, size }) => (
            <Icon name="car-multiple" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduledBookingsScreen}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const MainNavigator = () => {
  const { user, roleOverride } = useAppSelector((state) => state.auth);
  const verification = useAppSelector((state) => state.driver.verification);

  const effectiveUserType = (() => {
    if (user?.userType === UserType.DRIVER && roleOverride === UserType.CUSTOMER) {
      return UserType.CUSTOMER;
    }
    return user?.userType;
  })();

  // Show loading while driver verification state is being fetched
  // This prevents the documents screen from flashing for verified drivers
  if (effectiveUserType === UserType.DRIVER && !verification.hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C9A84C" />
      </View>
    );
  }

  const tabsComponent = (() => {
    if (!user) return CustomerTabs;
    if (effectiveUserType === UserType.CUSTOMER) return CustomerTabs;
    if (effectiveUserType === UserType.DRIVER) {
      if (verification.documentsVerified) {
        return DriverTabs;
      }

      if (!verification.submitted) {
        return DriverDocumentsSubmitScreen as any;
      }

      if (verification.backgroundCheckStatus === 'REJECTED') {
        return DriverVerificationRejectedScreen as any;
      }

      return DriverVerificationPendingScreen as any;
    }
    return CustomerTabs;
  })();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right', animationDuration: 200 }}>
      <Stack.Screen
        name="Tabs"
        component={tabsComponent}
        key={`tabs-${effectiveUserType ?? 'NONE'}-${roleOverride ?? 'NO_OVERRIDE'}-${verification.documentsVerified ? 'VERIFIED' : 'UNVERIFIED'}-${verification.submitted ? 'SUB' : 'NOSUB'}-${verification.backgroundCheckStatus}`}
      />
      <Stack.Screen name="DriverDocumentsSubmit" component={DriverDocumentsSubmitScreen} />
      <Stack.Screen name="DriverVerificationPending" component={DriverVerificationPendingScreen} />
      <Stack.Screen name="DriverVerificationRejected" component={DriverVerificationRejectedScreen} />
      <Stack.Screen name="DriverBookingRequestDetails" component={DriverBookingRequestDetailsScreen} />
      <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
      <Stack.Screen name="RideConfirm" component={RideConfirmScreen} />
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
      <Stack.Screen name="Tracking" component={TrackingScreen} options={{ animation: 'fade', animationDuration: 150 }} />
      <Stack.Screen name="PromoCodes" component={PromoCodesScreen} />

      <Stack.Screen name="SupportChat" component={SupportChatScreen} />

      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} />
      <Stack.Screen name="MapPick" component={MapPickScreen} />
      <Stack.Screen name="Safety" component={SafetyScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
      <Stack.Screen name="Referral" component={ReferralScreen} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="RideReceipt" component={RideReceiptScreen} />
      <Stack.Screen name="FavoriteDrivers" component={FavoriteDriversScreen} />
      <Stack.Screen name="StreakBonus" component={StreakBonusScreen} />
      <Stack.Screen name="PayoutSettings" component={PayoutSettingsScreen} />
      <Stack.Screen name="AirportTransfer" component={AirportTransferScreen} />
      <Stack.Screen name="DailyBooking" component={DailyBookingScreen} />
      <Stack.Screen name="InAppChat" component={InAppChatScreen} />
      <Stack.Screen name="DriverTiers" component={DriverTiersScreen} />
      <Stack.Screen name="HeatMap" component={HeatMapScreen} />
      <Stack.Screen name="CustomerWallet" component={CustomerWalletScreen} />
      <Stack.Screen name="WalletTopup" component={WalletTopupScreen} />
      <Stack.Screen name="WalletTransactions" component={WalletTransactionsScreen} />
      <Stack.Screen name="Membership" component={MembershipScreen} />
      <Stack.Screen name="TipDriver" component={TipDriverScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="DriverWallet" component={DriverWalletScreen} />
      <Stack.Screen name="TripPhotos" component={TripPhotoScreen} />
      <Stack.Screen name="DriverBadges" component={DriverBadgesScreen} />
      <Stack.Screen name="SharedTrip" component={SharedTripScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;
