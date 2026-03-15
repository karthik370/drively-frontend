import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import PremiumButton from '../../components/premium/PremiumButton';
import { colors, goldGradient } from '../../theme';

let LinearGradient: any;
try { LinearGradient = require('expo-linear-gradient').LinearGradient; }
catch { LinearGradient = ({ style, children }: any) => <View style={[style, { backgroundColor: '#C9A84C' }]}>{children}</View>; }

const WelcomeScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={goldGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoRing}
          >
            <View style={styles.logoInner}>
              <Text style={styles.logoText}>🚗</Text>
            </View>
          </LinearGradient>
          <Text style={styles.appName}>DriveMate</Text>
          <Text style={styles.tagline}>Your Trusted Driver Service</Text>
        </View>

        <View style={styles.featuresContainer}>
          <FeatureItem icon="check-circle" text="Professional Drivers" />
          <FeatureItem icon="crosshairs-gps" text="Real-time Tracking" />
          <FeatureItem icon="shield-check" text="Safe & Secure" />
          <FeatureItem icon="headset" text="24/7 Support" />
        </View>

        <View style={styles.buttonContainer}>
          <PremiumButton
            title="Get Started"
            onPress={() => navigation.navigate('PhoneLogin')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.featureItem}>
    <Icon name={icon as any} size={20} color={colors.gold} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 60,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  featuresContainer: {
    marginVertical: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: colors.textBody,
  },
  buttonContainer: {
    gap: 16,
  },
});

export default WelcomeScreen;
