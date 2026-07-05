import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { UserType } from '../../types';
import { G } from '../../constants/glassStyles';

let LinearGradient: any;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = ({ style, children }: any) => (
    <View style={[style, { backgroundColor: G.accent }]}>{children}</View>
  );
}

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
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            How would you like to use <Text style={styles.brandText}>DriveGaadi</Text>?
          </Text>
          <Text style={styles.subtitle}>
            Select one option to create your account
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {/* CUSTOMER CARD */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              styles.customerCard,
              selectedType === UserType.CUSTOMER && styles.customerSelectedCard,
            ]}
            onPress={() => setSelectedType(UserType.CUSTOMER)}
            activeOpacity={0.85}
          >
            {selectedType === UserType.CUSTOMER && (
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.15)', 'transparent']}
                style={styles.cardGlow}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />
            )}

            <View style={styles.graphicContainer}>
              <LinearGradient
                colors={
                  selectedType === UserType.CUSTOMER
                    ? ['rgba(99, 102, 241, 0.25)', 'rgba(99, 102, 241, 0.05)']
                    : ['rgba(99, 102, 241, 0.08)', 'rgba(99, 102, 241, 0.01)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.graphicCircle,
                  styles.customerCircle,
                  selectedType === UserType.CUSTOMER && styles.customerCircleActive,
                ]}
              >
                <Icon
                  name="car-sports"
                  size={36}
                  color={
                    selectedType === UserType.CUSTOMER
                      ? '#818cf8'
                      : 'rgba(99, 102, 241, 0.6)'
                  }
                />
                <View
                  style={[
                    styles.badge,
                    styles.customerBadge,
                    selectedType === UserType.CUSTOMER && styles.customerBadgeActive,
                  ]}
                >
                  <Icon
                    name="account-outline"
                    size={14}
                    color={selectedType === UserType.CUSTOMER ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'}
                  />
                </View>
              </LinearGradient>
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.optionTitle}>I Need a Driver</Text>
              <Text style={styles.optionDescription}>
                Book professional drivers for your vehicle
              </Text>
            </View>

            {selectedType === UserType.CUSTOMER && (
              <View style={styles.checkmark}>
                <Icon name="check-circle" size={24} color="#6366f1" />
              </View>
            )}
          </TouchableOpacity>

          {/* DRIVER CARD */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              styles.driverCard,
              selectedType === UserType.DRIVER && styles.driverSelectedCard,
            ]}
            onPress={() => setSelectedType(UserType.DRIVER)}
            activeOpacity={0.85}
          >
            {selectedType === UserType.DRIVER && (
              <LinearGradient
                colors={['rgba(34, 197, 94, 0.15)', 'transparent']}
                style={styles.cardGlow}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              />
            )}

            <View style={styles.graphicContainer}>
              <LinearGradient
                colors={
                  selectedType === UserType.DRIVER
                    ? ['rgba(34, 197, 94, 0.25)', 'rgba(34, 197, 94, 0.05)']
                    : ['rgba(34, 197, 94, 0.08)', 'rgba(34, 197, 94, 0.01)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.graphicCircle,
                  styles.driverCircle,
                  selectedType === UserType.DRIVER && styles.driverCircleActive,
                ]}
              >
                <Icon
                  name="steering"
                  size={36}
                  color={
                    selectedType === UserType.DRIVER
                      ? '#4ade80'
                      : 'rgba(34, 197, 94, 0.6)'
                  }
                />
                <View
                  style={[
                    styles.badge,
                    styles.driverBadge,
                    selectedType === UserType.DRIVER && styles.driverBadgeActive,
                  ]}
                >
                  <Icon
                    name="wallet-outline"
                    size={14}
                    color={selectedType === UserType.DRIVER ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'}
                  />
                </View>
              </LinearGradient>
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.optionTitle}>I Want to Drive</Text>
              <Text style={styles.optionDescription}>
                Earn money as a professional driver
              </Text>
            </View>

            {selectedType === UserType.DRIVER && (
              <View style={styles.checkmark}>
                <Icon name="check-circle" size={24} color="#22c55e" />
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
    backgroundColor: G.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: G.textPrimary,
    marginBottom: 10,
    lineHeight: 34,
  },
  brandText: {
    color: G.accent,
  },
  subtitle: {
    fontSize: 15,
    color: G.textSecondary,
    lineHeight: 22,
  },
  optionsContainer: {
    flex: 1,
    gap: 20,
  },
  optionCard: {
    backgroundColor: G.glass1,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  customerCard: {
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  customerSelectedCard: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  driverCard: {
    borderColor: 'rgba(34, 197, 94, 0.15)',
  },
  driverSelectedCard: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  cardGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '45%',
    opacity: 0.55,
  },
  graphicContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  graphicCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  customerCircle: {
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  customerCircleActive: {
    borderColor: '#6366f1',
  },
  driverCircle: {
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  driverCircleActive: {
    borderColor: '#22c55e',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerBadge: {
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  customerBadgeActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  driverBadge: {
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  driverBadgeActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  textContainer: {
    flex: 1,
    paddingRight: 12,
    zIndex: 2,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: G.textPrimary,
    marginBottom: 6,
  },
  optionDescription: {
    fontSize: 13,
    color: G.textSecondary,
    lineHeight: 18,
  },
  checkmark: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 3,
  },
  continueButton: {
    backgroundColor: G.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 24,
    ...Platform.select({
      ios: {
        shadowColor: G.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  disabledButton: {
    opacity: 0.4,
  },
  continueButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default UserTypeSelectionScreen;
