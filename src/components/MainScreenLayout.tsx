import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fetchUnreadMessageCount } from '../api/messagesApi';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import { getStoredUser } from '../storage/authSession';
import { BottomTabBar, type MainTabKey } from './BottomTabBar';
import { ScreenSafeArea } from './ScreenSafeArea';
import { colors } from '../theme/colors';

type MainScreenLayoutProps = {
  activeTab: MainTabKey;
  children: ReactNode;
};

export function MainScreenLayout({ activeTab, children }: MainScreenLayoutProps) {
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const loadProfileImage = useCallback(async () => {
    const user = await getStoredUser();
    setProfileImageUri(user?.profilePhotoUrl ?? null);
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const result = await fetchUnreadMessageCount();
      setUnreadMessages(result.unreadCount);
    } catch {
      // Non-critical; leave the badge as-is.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfileImage();
      void loadUnread();
    }, [loadProfileImage, loadUnread]),
  );

  useRealtimeEvent('message:new', () => {
    void loadUnread();
  });
  useRealtimeEvent('message:read', () => {
    void loadUnread();
  });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea style={styles.content}>{children}</ScreenSafeArea>
      <BottomTabBar
        activeTab={activeTab}
        profileImageUri={profileImageUri}
        messagesBadge={unreadMessages}
      />
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
