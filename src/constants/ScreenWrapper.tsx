/**
 * ScreenWrapper — Universal safe area handler for all Drively screens.
 *
 * Usage:
 *   <ScreenWrapper>          — handles top + bottom (standard full screen)
 *   <ScreenWrapper edges={['bottom']}>  — bottom only (inside nav header)
 *   <ScreenWrapper edges={['top','bottom']}>  — both (modal/standalone)
 *
 * This replaces inconsistent SafeAreaView usage across all screens.
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { G } from './glassStyles';

interface ScreenWrapperProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  bg?: string;
}

const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  style,
  bg = G.bg,
}) => {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bg }, style]}
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ScreenWrapper;
