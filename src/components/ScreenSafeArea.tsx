import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewProps, ViewStyle } from 'react-native';
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
  pointerEvents?: ViewProps['pointerEvents'];
};

export function ScreenSafeArea({
  children,
  edges = TAB_SCREEN_EDGES,
  style,
  pointerEvents,
}: ScreenSafeAreaProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges} pointerEvents={pointerEvents}>
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
