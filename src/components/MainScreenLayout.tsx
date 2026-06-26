import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getStoredUser } from '../storage/authSession';
import { BottomTabBar, type MainTabKey } from './BottomTabBar';
import { ScreenSafeArea } from './ScreenSafeArea';
import { colors } from '../theme/colors';

type MainScreenLayoutProps = {
  activeTab?: MainTabKey | null;
  children: ReactNode;
};

export function MainScreenLayout({ activeTab = null, children }: MainScreenLayoutProps) {
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);

  const loadProfileImage = useCallback(async () => {
    const user = await getStoredUser();
    setProfileImageUri(user?.profilePhotoUrl ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfileImage();
    }, [loadProfileImage]),
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea style={styles.content}>{children}</ScreenSafeArea>
      <BottomTabBar activeTab={activeTab} profileImageUri={profileImageUri} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
  },
});
