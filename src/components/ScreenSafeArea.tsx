import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

/** Tab screens: top inset only — bottom tab bar handles the home-indicator area. */
export const TAB_SCREEN_EDGES: Edge[] = ['top', 'left', 'right'];

/** Stack / modal screens: respect system status bar and home-indicator bars. */
export const STACK_SCREEN_EDGES: Edge[] = ['top', 'left', 'right', 'bottom'];

type ScreenSafeAreaProps = {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

export function ScreenSafeArea({
  children,
  edges = TAB_SCREEN_EDGES,
  style,
}: ScreenSafeAreaProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
});
