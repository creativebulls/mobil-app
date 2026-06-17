import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { emitHomeReselect } from '../navigation/tabEvents';

export type MainTabKey = 'home' | 'messages' | 'profile';

type BottomTabBarProps = {
  activeTab: MainTabKey;
  profileImageUri?: string | null;
  messagesBadge?: number;
};

const TAB_ROUTES: Record<MainTabKey, '/home' | '/messages' | '/profile'> = {
  home: '/home',
  messages: '/messages',
  profile: '/profile',
};

export function BottomTabBar({ activeTab, profileImageUri, messagesBadge = 0 }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleTabPress(tab: MainTabKey) {
    if (tab === 'home') {
      if (activeTab === 'home') {
        emitHomeReselect();
      }
      router.replace(TAB_ROUTES.home);
      return;
    }

    if (tab === activeTab) {
      return;
    }

    router.replace(TAB_ROUTES[tab]);
  }

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Pressable
        onPress={() => handleTabPress('home')}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Home"
        accessibilityState={{ selected: activeTab === 'home' }}
      >
        <Ionicons
          name={activeTab === 'home' ? 'home' : 'home-outline'}
          size={24}
          color={activeTab === 'home' ? colors.brand : colors.labelGray}
        />
        <Text style={[styles.label, activeTab === 'home' && styles.labelActive]}>Home</Text>
      </Pressable>

      <Pressable
        onPress={() => handleTabPress('messages')}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Messages"
        accessibilityState={{ selected: activeTab === 'messages' }}
      >
        <View>
          <Ionicons
            name={activeTab === 'messages' ? 'chatbubble' : 'chatbubble-outline'}
            size={24}
            color={activeTab === 'messages' ? colors.brand : colors.labelGray}
          />
          {messagesBadge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{messagesBadge > 99 ? '99+' : messagesBadge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, activeTab === 'messages' && styles.labelActive]}>Messages</Text>
      </Pressable>

      <Pressable
        onPress={() => handleTabPress('profile')}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Profile"
        accessibilityState={{ selected: activeTab === 'profile' }}
      >
        {profileImageUri ? (
          <View style={[styles.profileWrap, activeTab === 'profile' && styles.profileWrapActive]}>
            <Image source={{ uri: profileImageUri }} style={styles.profileImage} resizeMode="cover" />
          </View>
        ) : (
          <Ionicons
            name={activeTab === 'profile' ? 'person-circle' : 'person-circle-outline'}
            size={28}
            color={activeTab === 'profile' ? colors.brand : colors.labelGray}
          />
        )}
        <Text style={[styles.label, activeTab === 'profile' && styles.labelActive]}>Profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  tabPressed: {
    opacity: 0.75,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.labelGray,
  },
  labelActive: {
    color: colors.brand,
    fontWeight: '700',
  },
  profileWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  profileWrapActive: {
    borderColor: colors.brand,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
});
