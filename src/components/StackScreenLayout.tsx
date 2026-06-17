import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Edge } from 'react-native-safe-area-context';

import { ScreenSafeArea, STACK_SCREEN_EDGES } from './ScreenSafeArea';
import { colors } from '../theme/colors';

type StackScreenLayoutProps = {
  children: ReactNode;
  statusBarStyle?: 'light' | 'dark' | 'auto';
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  rootStyle?: StyleProp<ViewStyle>;
};

export function StackScreenLayout({
  children,
  statusBarStyle = 'dark',
  edges = STACK_SCREEN_EDGES,
  style,
  rootStyle,
}: StackScreenLayoutProps) {
  return (
    <View style={[styles.root, rootStyle]}>
      <StatusBar style={statusBarStyle} />
      <ScreenSafeArea edges={edges} style={style}>
        {children}
      </ScreenSafeArea>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
});
