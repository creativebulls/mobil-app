import { useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getStoredUser } from '../storage/authSession';
import { BottomTabBar, type MainTabKey } from './BottomTabBar';
import { colors } from '../theme/colors';

type MainScreenLayoutProps = {
  activeTab: MainTabKey;
  children: ReactNode;
};

export function MainScreenLayout({ activeTab, children }: MainScreenLayoutProps) {
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
      <View style={styles.content}>{children}</View>
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
