import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  fetchFavoritePlaces,
  fetchFriends,
  fetchMyPosts,
  fetchProfileStats,
  updateProfileStatus,
  type FavoritePlace,
  type FriendSummary,
  type ProfileStats,
} from '../src/api/profileApi';
import { updateProfilePhoto } from '../src/api/authApi';
import { getErrorMessage, type Post } from '../src/api/types';
import { Avatar } from '../src/components/Avatar';
import { BrandButton } from '../src/components/BrandButton';
import { FeedPostCard } from '../src/components/FeedPostCard';
import { FriendsHorizontalList } from '../src/components/FriendsHorizontalList';
import { MainScreenLayout } from '../src/components/MainScreenLayout';
import { ProfileFavoritePlaces } from '../src/components/ProfileFavoritePlaces';
import { ProfileStatusEditor } from '../src/components/ProfileStatusEditor';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { getStoredUser, updateStoredUser } from '../src/storage/authSession';
import type { UserProfile } from '../src/api/types';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusEditorVisible, setStatusEditorVisible] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const [storedUser, statsResult, friendsResult, placesResult, postsResult] = await Promise.all([
        getStoredUser(),
        fetchProfileStats(),
        fetchFriends(),
        fetchFavoritePlaces(),
        fetchMyPosts(),
      ]);

      setUser(storedUser);
      setStats(statsResult);
      setFriends(friendsResult.friends);
      setFavoritePlaces(placesResult.places);
      setPosts(postsResult.posts);

      if (storedUser) {
        await updateStoredUser({
          ...storedUser,
          statusText: statsResult.statusText,
          points: statsResult.points,
        });
      }
    } catch {
      // keep cached data
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadProfile();
    setIsRefreshing(false);
  }

  async function handleSaveStatus(statusText: string) {
    const result = await updateProfileStatus(statusText);
    setStats((current) => (current ? { ...current, statusText: result.statusText } : current));
    if (user) {
      await updateStoredUser({ ...user, statusText: result.statusText });
      setUser({ ...user, statusText: result.statusText });
    }
  }

  async function handleChangeProfilePhoto() {
    if (isUploadingPhoto) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await dialog.alert({
        title: 'Permission required',
        message: 'Please allow photo library access to change your profile picture.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    const pickedUri = result.canceled ? null : result.assets[0]?.uri;
    if (!pickedUri) {
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const updated = await updateProfilePhoto(pickedUri);
      setUser(updated);
      await updateStoredUser(updated);
    } catch (uploadError) {
      await dialog.alert({
        title: 'Upload failed',
        message: getErrorMessage(uploadError, 'Could not update your profile picture. Try again.'),
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function handleExchangePoints() {
    void dialog.alert({
      title: 'Exchange points',
      message: 'Points exchange is coming soon. Keep engaging to earn more!',
    });
  }

  function handlePlacePress(place: FavoritePlace) {
    router.push({
      pathname: '/place-detail',
      params: { id: place.id, name: place.name, imageUrl: place.imageUrl },
    });
  }

  const displayName =
    user?.givenName && user?.surname
      ? `${user.givenName} ${user.surname}`
      : user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.email?.split('@')[0] ?? 'Profile';

  const username = user?.email?.split('@')[0] ?? displayName;

  return (
    <MainScreenLayout activeTab="profile">
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <Pressable
            onPress={() => router.push('/qr-connect')}
            style={[styles.headerSide, styles.headerSideLeft]}
            hitSlop={8}
            accessibilityLabel="Connect by QR code"
          >
            <Ionicons name="qr-code-outline" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerUsername} numberOfLines={1}>
            {username}
          </Text>
          <Pressable
            onPress={() => router.push('/settings')}
            style={styles.headerSide}
            hitSlop={8}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
            }
          >
            <View style={styles.profileBlock}>
              <Pressable
                onPress={handleChangeProfilePhoto}
                disabled={isUploadingPhoto}
                style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Change profile picture"
              >
                <Avatar uri={user?.profilePhotoUrl} name={displayName} size={96} />
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={16} color={colors.white} />
                </View>
                {isUploadingPhoto ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.editProfileLink, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Text style={styles.editProfileText}>Edit profile</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setStatusEditorVisible(true)}
              style={({ pressed }) => [styles.statusRow, pressed && styles.pressed]}
            >
              <Text style={styles.statusText} numberOfLines={3}>
                {stats?.statusText?.trim() ? stats.statusText : 'Tap to set your status 😊'}
              </Text>
            </Pressable>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, styles.pointsValue]}>{stats?.points ?? 0}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={styles.statDivider} />
              <Pressable style={styles.statItem} onPress={() => router.push('/friends')}>
                <Text style={styles.statValue}>{stats?.friendsCount ?? 0}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.postsCount ?? 0}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
            </View>

            <BrandButton
              label="Exchange points"
              onPress={handleExchangePoints}
              style={styles.exchangeButton}
            />

            <FriendsHorizontalList
              friends={friends}
              onAddPress={() => router.push('/add-friends')}
              onFriendPress={(friend) => openUserProfile(router, friend.id, user?.id)}
            />

            <ProfileFavoritePlaces places={favoritePlaces} onPlacePress={handlePlacePress} />

            <View style={styles.postsSection}>
              <Text style={styles.postsTitle}>My Posts</Text>
              {posts.length === 0 ? (
                <Text style={styles.emptyPosts}>You haven&apos;t posted yet.</Text>
              ) : (
                posts.map((post) => (
                  <FeedPostCard
                    key={post.id}
                    post={post}
                    currentUserId={user?.id}
                    onCommentPress={(item) =>
                      router.push({ pathname: '/comments', params: { postId: item.id } })
                    }
                  />
                ))
              )}
            </View>
          </ScrollView>
        )}

        <ProfileStatusEditor
          visible={statusEditorVisible}
          initialStatus={stats?.statusText ?? ''}
          onClose={() => setStatusEditorVisible(false)}
          onSave={handleSaveStatus}
        />
      </View>
    </MainScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSide: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerSideLeft: {
    alignItems: 'flex-start',
  },
  headerUsername: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  loader: {
    marginTop: 40,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileBlock: {
    alignItems: 'center',
    paddingTop: 24,
    gap: 14,
  },
  avatarWrap: {
    width: 96,
    height: 96,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileLink: {
    paddingVertical: 4,
  },
  editProfileText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
  statusRow: {
    marginHorizontal: 24,
    marginTop: 12,
    paddingVertical: 4,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginHorizontal: 20,
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  pointsValue: {
    color: colors.brand,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: colors.border,
  },
  exchangeButton: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  postsSection: {
    marginTop: 28,
    paddingHorizontal: 0,
  },
  postsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  emptyPosts: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
