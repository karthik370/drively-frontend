import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneLoginScreen from '../screens/auth/PhoneLoginScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import UserTypeSelectionScreen from '../screens/auth/UserTypeSelectionScreen';

const Stack = createNativeStackNavigator();

const AuthNavigator = ({ route }: { route?: any }) => {
  // Passed by AppNavigator when pendingSignup exists in Redux:
  // user verified OTP but closed app before completing signup
  const initialRoute = route?.params?.initialRoute as string | undefined;
  const pendingPhoneNumber = route?.params?.phoneNumber as string | undefined;
  const pendingMsg91AccessToken = route?.params?.msg91AccessToken as string | undefined;
  const pendingOtpSignupToken = route?.params?.otpSignupToken as string | undefined;

  const hasPendingSignup = initialRoute === 'UserTypeSelection' && pendingPhoneNumber && pendingMsg91AccessToken;

  return (
    <Stack.Navigator
      initialRouteName={hasPendingSignup ? 'UserTypeSelection' : 'Welcome'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen
        name="UserTypeSelection"
        component={UserTypeSelectionScreen}
        initialParams={hasPendingSignup ? {
          phoneNumber: pendingPhoneNumber,
          msg91AccessToken: pendingMsg91AccessToken,
          otpSignupToken: pendingOtpSignupToken || '',
        } : undefined}
      />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
