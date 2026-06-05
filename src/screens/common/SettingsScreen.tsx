import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Switch } from 'react-native-paper';
import { G } from '../../constants/glassStyles';

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
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Icon name="cog" size={22} color="#C9A84C" />
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.card}>
          {rows.map((r) => (
            <View key={r.key} style={styles.row}>
              <View style={styles.rowLeft}>
                <Icon name={r.icon as any} size={20} color="#8A8A8A" />
                <Text style={styles.rowTitle}>{r.title}</Text>
              </View>
              <Switch value={r.value} onValueChange={r.onChange} />
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Icon name="information" size={16} color="#8A8A8A" />
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
    backgroundColor: G.bgAlt,
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
    color: G.textPrimary,
  },
  card: {
    backgroundColor: G.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border3,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
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
    color: G.textPrimary,
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
    color: G.textSecondary,
    lineHeight: 18,
  },
});

export default SettingsScreen;
