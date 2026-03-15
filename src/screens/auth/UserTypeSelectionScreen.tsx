import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { UserType } from '../../types';

const UserTypeSelectionScreen = ({ route, navigation }: any) => {
  const { phoneNumber, msg91AccessToken, otpSignupToken } = route.params;
  const [selectedType, setSelectedType] = useState<UserType | null>(null);

  const handleContinue = () => {
    if (selectedType) {
      navigation.navigate('Signup', {
        phoneNumber,
        userType: selectedType,
        msg91AccessToken,
        otpSignupToken,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>How would you like to use DriveMate?</Text>
          <Text style={styles.subtitle}>
            Select one option to create your account
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === UserType.CUSTOMER && styles.selectedCard,
            ]}
            onPress={() => setSelectedType(UserType.CUSTOMER)}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>🚗</Text>
            </View>
            <Text style={styles.optionTitle}>I Need a Driver</Text>
            <Text style={styles.optionDescription}>
              Book professional drivers for your vehicle
            </Text>
            {selectedType === UserType.CUSTOMER && (
              <View style={styles.checkmark}>
                <Icon name="check-circle" size={24} color="#10b981" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === UserType.DRIVER && styles.selectedCard,
            ]}
            onPress={() => setSelectedType(UserType.DRIVER)}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>🚙</Text>
            </View>
            <Text style={styles.optionTitle}>I Want to Drive</Text>
            <Text style={styles.optionDescription}>
              Earn money as a professional driver
            </Text>
            {selectedType === UserType.DRIVER && (
              <View style={styles.checkmark}>
                <Icon name="check-circle" size={24} color="#10b981" />
              </View>
            )}
          </TouchableOpacity>

        </View>

        <TouchableOpacity
          style={[styles.continueButton, !selectedType && styles.disabledButton]}
          onPress={handleContinue}
          disabled={!selectedType}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  titleContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8A8A',
    lineHeight: 24,
  },
  optionsContainer: {
    flex: 1,
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#111111',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  selectedCard: {
    borderColor: '#C9A84C',
    backgroundColor: '#141414',
  },
  iconContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#0A0A0A',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#8A8A8A',
    lineHeight: 20,
  },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  continueButton: {
    backgroundColor: '#C9A84C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 24,
  },
  disabledButton: {
    opacity: 0.4,
  },
  continueButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserTypeSelectionScreen;
