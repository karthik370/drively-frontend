import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch } from '../../redux/store';
import { signup } from '../../redux/slices/authSlice';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const SignupScreen = ({ route, navigation }: any) => {
  const { phoneNumber, userType, msg91AccessToken, otpSignupToken } = route.params;
  const dispatch = useAppDispatch();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      showAlert('Error', 'Please fill in all required fields');
      return;
    }

    const email = formData.email.trim();
    if (!email) {
      showAlert('Email Required', 'Please enter your email address. It is used for payment receipts and notifications.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Invalid Email', 'Please enter a valid email address.');
      return;
    }



    setIsLoading(true);
    try {
      const payload: any = {
        phoneNumber,
        userType,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        otpSignupToken,
        msg91AccessToken,
      };



      const emailVal = formData.email.trim().toLowerCase();
      payload.email = emailVal;

      await dispatch(signup(payload)).unwrap();
    } catch (err: any) {
      showAlert('Error', err || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top','bottom']} style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#C9A84C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Tell us a bit about yourself
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your first name"
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your last name"
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#555"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.emailHint}>Used for payment receipts and notifications</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={phoneNumber}
              editable={false}
            />
          </View>


        </View>

        <TouchableOpacity
          style={[styles.signupButton, isLoading && styles.disabledButton]}
          onPress={handleSignup}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.signupButtonText}>Complete Signup</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: G.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: G.textSecondary,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: G.textPrimary,
  },
  disabledInput: {
    backgroundColor: G.glass2,
    color: G.textSecondary,
  },
  emailHint: {
    fontSize: 11,
    color: G.textSecondary,
    marginTop: 6,
    fontWeight: '500',
  },
  signupButton: {
    backgroundColor: G.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  disabledButton: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: G.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SignupScreen;
