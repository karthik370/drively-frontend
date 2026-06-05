import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

type Lang = {
  key: string;
  label: string;
};

const LanguageSelectionScreen = () => {
  const languages: Lang[] = useMemo(
    () => [
      { key: 'en', label: 'English' },
      { key: 'hi', label: 'Hindi' },
      { key: 'kn', label: 'Kannada' },
      { key: 'ta', label: 'Tamil' },
      { key: 'te', label: 'Telugu' },
    ],
    []
  );

  const [selected, setSelected] = useState('en');

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Icon name="translate" size={22} color="#C9A84C" />
          <Text style={styles.title}>Language</Text>
        </View>

        <View style={styles.card}>
          {languages.map((l) => {
            const isSelected = l.key === selected;
            return (
              <TouchableOpacity
                key={l.key}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => {
                  setSelected(l.key);
                }}
              >
                <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{l.label}</Text>
                {isSelected ? <Icon name="check" size={20} color="#C9A84C" /> : null}
              </TouchableOpacity>
            );
          })}
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
    overflow: 'hidden',
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
  rowSelected: {
    backgroundColor: G.glass2,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '700',
    color: G.textPrimary,
  },
  rowTextSelected: {
    color: '#1d4ed8',
  },
});

export default LanguageSelectionScreen;
