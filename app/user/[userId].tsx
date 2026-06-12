import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  acceptFriendRequest,
  fetchUserProfile,
  rejectFriendRequest,
  sendFriendRequest,
} from '../../src/api/profileApi';
import {
  blockUser,
  openConversationWith,
  restrictUser,
  unblockUser,
  unrestrictUser,
} from '../../src/api/messagesApi';
import type { PublicUserProfile, UserRelationship } from '../../src/api/types';
import { getErrorMessage, type Post } from '../../src/api/types';
import { Avatar } from '../../src/components/Avatar';
import { BrandButton } from '../../src/components/BrandButton';
import { FeedPostCard } from '../../src/components/FeedPostCard';
import { useDialog } from '../../src/components/dialog/DialogProvider';
import { getStoredUser } from '../../src/storage/authSession';
import { openUserProfile } from '../../src/utils/openUserProfile';
import { colors } from '../../src/theme/colors';

export default function UserProfileScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [relationship, setRelationship] = useState<UserRelationship | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const [result, me] = await Promise.all([fetchUserProfile(userId), getStoredUser()]);
      setCurrentUserId(me?.id ?? null);

      if (result.relationship.isSelf) {
        router.replace('/profile');
        return;
      }

      setProfile(result.user);
      setRelationship(result.relationship);
      setPosts(result.posts);
      setError('');
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Could not load profile'));
    } finally {
      setIsLoading(false);
    }
  }, [router, userId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void load();
    }, [load]),
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  async function handleAddFriend() {
    if (!userId) {
      return;
    }
    setIsActing(true);
    try {
      const result = await sendFriendRequest(userId);
      if (result.status === 'accepted') {
        setRelationship({
          isSelf: false,
          isFriend: true,
          friendRequestStatus: null,
          friendRequestId: null,
        });
        setProfile((current) =>
          current ? { ...current, friendsCount: current.friendsCount + 1 } : current,
        );
      } else {
        setRelationship({
          isSelf: false,
          isFriend: false,
          friendRequestStatus: 'sent',
          friendRequestId: result.requestId,
        });
      }
    } catch (actionError) {
      await dialog.alert({
        title: 'Could not send request',
        message: getErrorMessage(actionError, 'Try again later'),
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleAccept() {
    if (!relationship?.friendRequestId) {
      return;
    }
    setIsActing(true);
    try {
      await acceptFriendRequest(relationship.friendRequestId);
      setRelationship({
        isSelf: false,
        isFriend: true,
        friendRequestStatus: null,
        friendRequestId: null,
      });
      setProfile((current) =>
        current ? { ...current, friendsCount: current.friendsCount + 1 } : current,
      );
    } catch (actionError) {
      await dialog.alert({
        title: 'Could not accept',
        message: getErrorMessage(actionError, 'Try again later'),
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleDecline() {
    if (!relationship?.friendRequestId) {
      return;
    }
    setIsActing(true);
    try {
      await rejectFriendRequest(relationship.friendRequestId);
      setRelationship({
        isSelf: false,
        isFriend: false,
        friendRequestStatus: null,
        friendRequestId: null,
      });
    } catch (actionError) {
      await dialog.alert({
        title: 'Could not decline',
        message: getErrorMessage(actionError, 'Try again later'),
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleMessage() {
    if (!userId) {
      return;
    }
    setIsActing(true);
    try {
      const opened = await openConversationWith(userId);
      router.push({
        pathname: '/chat',
        params: {
          conversationId: opened.id,
          userId: opened.user.id,
          name: opened.user.name,
          avatarUri: opened.user.avatarUri ?? '',
        },
      });
    } catch (actionError) {
      await dialog.alert({
        title: 'Could not open chat',
        message: getErrorMessage(actionError, 'Try again later'),
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleBlock() {
    if (!userId) {
      return;
    }
    setMenuOpen(false);
    const confirmed = await dialog.confirm({
      title: `Block ${profile?.name ?? 'this user'}?`,
      message:
        'They will not be able to message you, send friend requests, or view your profile. Any existing friendship is removed.',
      confirmText: 'Block',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    setIsActing(true);
    try {
      await blockUser(userId);
      setRelationship((current) =>
        current ? { ...current, isFriend: false, friendRequestStatus: null, friendRequestId: null, blockedByMe: true } : current,
      );
    } catch (actionError) {
      await dialog.alert({
        title: 'Could not block',
        message: getErrorMessage(actionError, 'Try again later'),
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleUnblock() {
    if (!userId) {
      return;
    }
    setMenuOpen(false);
    setIsActing(true);
    try {
      await unblockUser(userId);
      setRelationship((current) => (current ? { ...current, blockedByMe: false } : current));
      await load();
    } catch (actionError) {
      await dialog.alert({
        title: 'Could not unblock',
        message: getErrorMessage(actionError, 'Try again later'),
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleToggleRestrict() {
    if (!userId || !relationship) {
      return;
    }
    setMenuOpen(false);
    const isRestricting = !relationship.restrictedByMe;
    setIsActing(true);
    try {
      if (isRestricting) {
        await restrictUser(userId);
      } else {
        await unrestrictUser(userId);
      }
      setRelationship((current) => (current ? { ...current, restrictedByMe: isRestricting } : current));
    } catch (actionError) {
      await dialog.alert({
        title: 'Could not update',
        message: getErrorMessage(actionError, 'Try again later'),
      });
    } finally {
      setIsActing(false);
    }
  }

  function renderFriendAction() {
    if (!relationship || !profile) {
      return null;
    }

    if (relationship.isFriend) {
      return (
        <View style={styles.friendsBadge}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.friendsBadgeText}>Friends</Text>
        </View>
      );
    }

    if (relationship.friendRequestStatus === 'sent') {
      return (
        <Pressable style={styles.pendingButton} disabled>
          <Text style={styles.pendingButtonText}>Request pending</Text>
        </Pressable>
      );
    }

    if (relationship.friendRequestStatus === 'received') {
      return (
        <View style={styles.requestActions}>
          <BrandButton
            label={isActing ? 'Accepting…' : 'Accept request'}
            onPress={handleAccept}
            disabled={isActing}
            style={styles.actionHalf}
          />
          <Pressable
            onPress={handleDecline}
            disabled={isActing}
            style={({ pressed }) => [styles.declineOutline, pressed && styles.pressed]}
          >
            <Text style={styles.declineOutlineText}>Decline</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <BrandButton
        label={isActing ? 'Sending…' : 'Add friend'}
        onPress={handleAddFriend}
        disabled={isActing}
        style={styles.addFriendButton}
      />
    );
  }

  const username = profile?.name.split(' ')[0] ?? 'User';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {username}
          </Text>
          {profile && !relationship?.blockedMe ? (
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : profile ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
            }
          >
            <View style={styles.profileBlock}>
              <Avatar uri={profile.avatarUri} name={profile.name} size={96} />
              <Text style={styles.displayName}>{profile.name}</Text>
            </View>

            {profile.statusText ? (
              <Text style={styles.statusText}>{profile.statusText}</Text>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, styles.pointsValue]}>{profile.points}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.friendsCount}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.postsCount}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
            </View>

            {relationship?.blockedByMe ? (
              <View style={styles.blockedBox}>
                <Text style={styles.blockedText}>You blocked this user.</Text>
                <Pressable
                  onPress={handleUnblock}
                  disabled={isActing}
                  style={({ pressed }) => [styles.unblockButton, pressed && styles.pressed]}
                >
                  <Text style={styles.unblockButtonText}>{isActing ? 'Unblocking…' : 'Unblock'}</Text>
                </Pressable>
              </View>
            ) : relationship?.blockedMe ? (
              <Text style={styles.unavailable}>This account is unavailable.</Text>
            ) : (
              <>
                {renderFriendAction()}
                <Pressable
                  onPress={handleMessage}
                  disabled={isActing}
                  style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={colors.brand} />
                  <Text style={styles.messageButtonText}>Message</Text>
                </Pressable>
                {relationship?.restrictedByMe ? (
                  <Text style={styles.restrictedNote}>You restricted this user.</Text>
                ) : null}
              </>
            )}

            <View style={styles.postsSection}>
              <Text style={styles.postsTitle}>Posts</Text>
              {relationship?.blockedByMe || relationship?.blockedMe ? (
                <Text style={styles.emptyPosts}>Posts are hidden.</Text>
              ) : relationship?.isLocked ? (
                <View style={styles.privateNotice}>
                  <Ionicons name="lock-closed" size={26} color={colors.labelGray} />
                  <Text style={styles.privateTitle}>This account is private</Text>
                  <Text style={styles.privateSubtitle}>
                    Become friends to see their posts and activity.
                  </Text>
                </View>
              ) : posts.length === 0 ? (
                <Text style={styles.emptyPosts}>No posts yet.</Text>
              ) : (
                posts.map((post) => (
                  <FeedPostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    onAuthorPress={(authorId) => openUserProfile(router, authorId, currentUserId)}
                    onCommentPress={(item) =>
                      router.push({ pathname: '/comments', params: { postId: item.id } })
                    }
                  />
                ))
              )}
            </View>
          </ScrollView>
        ) : null}

        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
            <View style={styles.menuSheet}>
              {relationship?.blockedByMe ? (
                <Pressable onPress={handleUnblock} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
                  <Ionicons name="lock-open-outline" size={20} color={colors.text} />
                  <Text style={styles.menuItemText}>Unblock</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable onPress={handleToggleRestrict} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
                    <Ionicons name="eye-off-outline" size={20} color={colors.text} />
                    <Text style={styles.menuItemText}>
                      {relationship?.restrictedByMe ? 'Unrestrict' : 'Restrict'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleBlock} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
                    <Ionicons name="ban-outline" size={20} color={colors.brand} />
                    <Text style={[styles.menuItemText, styles.menuItemDanger]}>Block</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setMenuOpen(false)} style={({ pressed }) => [styles.menuCancel, pressed && styles.pressed]}>
                <Text style={styles.menuCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  loader: {
    marginTop: 40,
  },
  error: {
    textAlign: 'center',
    color: colors.brand,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  scroll: {
    paddingBottom: 32,
  },
  profileBlock: {
    alignItems: 'center',
    paddingTop: 24,
    gap: 10,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  statusText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginHorizontal: 24,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.background,
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
  addFriendButton: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  requestActions: {
    marginHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  actionHalf: {
    marginTop: 0,
  },
  declineOutline: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  declineOutlineText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pendingButton: {
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.inputGray,
  },
  pendingButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.labelGray,
  },
  friendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  friendsBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  postsSection: {
    marginTop: 28,
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
  privateNotice: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  privateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  privateSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  restrictedNote: {
    textAlign: 'center',
    color: colors.labelGray,
    fontSize: 13,
    marginTop: 10,
  },
  blockedBox: {
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
    gap: 12,
  },
  blockedText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  unblockButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  unblockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  unavailable: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 24,
    paddingHorizontal: 24,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  menuItemDanger: {
    color: colors.brand,
  },
  menuCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.inputGray,
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});
