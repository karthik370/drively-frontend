import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Switch } from 'react-native-paper';

const SettingsScreen = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMarketingEnabled, setIsMarketingEnabled] = useState(true);

  const rows = useMemo(
    () => [
      {
        key: 'dark',
        title: 'Dark mode',
        icon: 'weather-night',
        value: isDarkMode,
        onChange: setIsDarkMode,
      },
      {
        key: 'marketing',
        title: 'Offers & marketing',
        icon: 'sale',
        value: isMarketingEnabled,
        onChange: setIsMarketingEnabled,
      },
    ],
    [isDarkMode, isMarketingEnabled]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Icon name="cog" size={22} color="#111827" />
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.card}>
          {rows.map((r) => (
            <View key={r.key} style={styles.row}>
              <View style={styles.rowLeft}>
                <Icon name={r.icon as any} size={20} color="#6b7280" />
                <Text style={styles.rowTitle}>{r.title}</Text>
              </View>
              <Switch value={r.value} onValueChange={r.onChange} />
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Icon name="information" size={16} color="#6b7280" />
          <Text style={styles.noteText}>
            Dark mode toggle is UI-only right now. We’ll connect it to the app theme in the next step.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  note: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
});

export default SettingsScreen;
