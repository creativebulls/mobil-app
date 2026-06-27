import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppImage } from './AppImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { emitHomeReselect } from '../navigation/tabEvents';

export type MainTabKey = 'home' | 'map' | 'create' | 'profile';

type BottomTabBarProps = {
  activeTab?: MainTabKey | null;
  profileImageUri?: string | null;
};

const TAB_ROUTES: Record<Exclude<MainTabKey, 'create'>, '/home' | '/map' | '/profile'> = {
  home: '/home',
  map: '/map',
  profile: '/profile',
};

const TAB_ICON_SIZE = 20;
const CREATE_BUTTON_SIZE = 36;
const PROFILE_IMAGE_SIZE = 20;
const PROFILE_RING_WIDTH = 2;
const PROFILE_OUTER_SIZE = PROFILE_IMAGE_SIZE + PROFILE_RING_WIDTH * 2;

export function BottomTabBar({ activeTab = null, profileImageUri }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleTabPress(tab: Exclude<MainTabKey, 'create'>) {
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

  function handleCreatePress() {
    router.push('/create-post');
  }

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <Pressable
        onPress={() => handleTabPress('home')}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Home"
        accessibilityState={{ selected: activeTab === 'home' }}
      >
        <Ionicons
          name={activeTab === 'home' ? 'home' : 'home-outline'}
          size={TAB_ICON_SIZE}
          color={activeTab === 'home' ? colors.brand : colors.labelGray}
        />
      </Pressable>

      <Pressable
        onPress={() => handleTabPress('map')}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Friends map"
        accessibilityState={{ selected: activeTab === 'map' }}
      >
        <Ionicons
          name={activeTab === 'map' ? 'map' : 'map-outline'}
          size={TAB_ICON_SIZE}
          color={activeTab === 'map' ? colors.brand : colors.labelGray}
        />
      </Pressable>

      <Pressable
        onPress={handleCreatePress}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Create post"
      >
        <View style={styles.createButton}>
          <Ionicons name="add" size={22} color={colors.white} />
        </View>
      </Pressable>

      <Pressable
        onPress={() => handleTabPress('profile')}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Profile"
        accessibilityState={{ selected: activeTab === 'profile' }}
      >
        {profileImageUri ? (
          <View style={[styles.profileRing, activeTab === 'profile' && styles.profileRingActive]}>
            <AppImage
              source={{ uri: profileImageUri }}
              style={styles.profileImage}
              resizeMode="cover"
            />
          </View>
        ) : (
          <Ionicons
            name={activeTab === 'profile' ? 'person-circle' : 'person-circle-outline'}
            size={TAB_ICON_SIZE + 2}
            color={activeTab === 'profile' ? colors.brand : colors.labelGray}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingHorizontal: 24,
    minHeight: 48,
    backgroundColor: colors.surfaceMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceMutedBorder,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabPressed: {
    opacity: 0.75,
  },
  createButton: {
    width: CREATE_BUTTON_SIZE,
    height: CREATE_BUTTON_SIZE,
    borderRadius: CREATE_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  profileRing: {
    width: PROFILE_OUTER_SIZE,
    height: PROFILE_OUTER_SIZE,
    borderRadius: PROFILE_OUTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: PROFILE_RING_WIDTH,
    borderColor: 'transparent',
  },
  profileRingActive: {
    borderColor: colors.brand,
  },
  profileImage: {
    width: PROFILE_IMAGE_SIZE,
    height: PROFILE_IMAGE_SIZE,
    borderRadius: PROFILE_IMAGE_SIZE / 2,
    backgroundColor: colors.inputGray,
  },
});
