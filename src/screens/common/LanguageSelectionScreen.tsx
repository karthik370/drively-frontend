import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Icon name="translate" size={22} color="#111827" />
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
                {isSelected ? <Icon name="check" size={20} color="#2563eb" /> : null}
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
    overflow: 'hidden',
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
  rowSelected: {
    backgroundColor: '#eff6ff',
  },
  rowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  rowTextSelected: {
    color: '#1d4ed8',
  },
});

export default LanguageSelectionScreen;
