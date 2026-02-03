import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminDriverVerificationsScreen from '../screens/admin/AdminDriverVerificationsScreen';
import AdminDriverVerificationDetailScreen from '../screens/admin/AdminDriverVerificationDetailScreen';
import AdminNeedHelpInboxScreen from '../screens/admin/AdminNeedHelpInboxScreen';
import AdminRefundsScreen from '../screens/admin/AdminRefundsScreen';

const Stack = createNativeStackNavigator();

const AdminNavigator = ({ route }: any) => {
  const initialRouteName = String(route?.params?.initialRouteName || 'AdminNeedHelp');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName as any}>
      <Stack.Screen name="AdminNeedHelp" component={AdminNeedHelpInboxScreen} />
      <Stack.Screen name="AdminRefunds" component={AdminRefundsScreen} />
      <Stack.Screen name="AdminDriverVerifications" component={AdminDriverVerificationsScreen} />
      <Stack.Screen name="AdminDriverVerificationDetail" component={AdminDriverVerificationDetailScreen} />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
