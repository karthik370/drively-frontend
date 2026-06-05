import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

const SafetyScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Drive safe. Earn more. Stay protected.</Text>
          <Text style={styles.text}>
            Drively is built for professional drivers. Your safety and the customer's safety are the top priority.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Before you start</Text>
          <Text style={styles.text}>Keep your phone charged and internet ON.</Text>
          <Text style={styles.text}>Check brakes, lights, tyres and mirrors.</Text>
          <Text style={styles.text}>Keep documents ready and vehicle clean.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>During the trip</Text>
          <Text style={styles.text}>Follow speed limits and avoid harsh braking.</Text>
          <Text style={styles.text}>Use navigation safely. Don’t use the phone while driving.</Text>
          <Text style={styles.text}>Be polite, professional and follow app rules.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>If you feel unsafe</Text>
          <Text style={styles.text}>Stop at a safe public place.</Text>
          <Text style={styles.text}>Call emergency services if required.</Text>
          <Text style={styles.text}>Report the issue in Help & Support with booking details.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: G.glass2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: G.border3,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
  content: { padding: 16, paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '900', color: G.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: G.textPrimary },
  text: { marginTop: 8, color: '#CCCCCC', fontWeight: '700', lineHeight: 20 },
});

export default SafetyScreen;
