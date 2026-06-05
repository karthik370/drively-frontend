import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { G } from '../../constants/glassStyles';

const SwitchModeScreen = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bgAlt,
  },
});

export default SwitchModeScreen;
