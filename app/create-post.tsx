import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { createPost } from '../src/api/postsApi';
import { getErrorMessage } from '../src/api/types';
import { AppImage } from '../src/components/AppImage';
import { Avatar } from '../src/components/Avatar';
import { CreatePostComposerInput } from '../src/components/CreatePostComposerInput';
import { CreatePostPlaceField, type TaggedPlace } from '../src/components/CreatePostPlaceField';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { getStoredUser } from '../src/storage/authSession';
import type { PostReaction, UserProfile } from '../src/api/types';
import { colors } from '../src/theme/colors';
import { createVideoThumbnail } from '../src/utils/videoThumbnail';

const MAX_MEDIA = 6;

const REACTIONS: {
  key: PostReaction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'like', label: 'Like', icon: 'thumbs-up-outline', activeIcon: 'thumbs-up' },
  { key: 'dislike', label: 'Dislike', icon: 'thumbs-down-outline', activeIcon: 'thumbs-down' },
  { key: 'love', label: 'Love it', icon: 'heart-outline', activeIcon: 'heart' },
];

type PostMediaItem = { uri: string; type: 'image' | 'video'; thumbnailUri?: string | null };

async function assetToMediaItem(asset: ImagePicker.ImagePickerAsset): Promise<PostMediaItem> {
  const type = asset.type === 'video' ? 'video' : 'image';
  const thumbnailUri = type === 'video' ? await createVideoThumbnail(asset.uri) : null;
  return { uri: asset.uri, type, thumbnailUri };
}

function resolveDisplayName(user: UserProfile | null): string {
  if (user?.givenName && user?.surname) {
    return `${user.givenName} ${user.surname}`;
  }
  if (user?.firstName && user?.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user?.email?.split('@')[0] ?? 'You';
}

function CreatePostMediaTile({
  item,
  onRemove,
}: {
  item: PostMediaItem;
  onRemove: () => void;
}) {
  return (
    <View style={styles.mediaTile}>
      {item.type === 'video' ? (
        <View style={styles.mediaTileInner}>
          {item.thumbnailUri ? (
            <AppImage source={{ uri: item.thumbnailUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]}>
              <ActivityIndicator color={colors.white} />
            </View>
          )}
          <View style={styles.videoOverlay}>
            <Ionicons name="play" size={22} color={colors.white} />
          </View>
        </View>
      ) : (
        <AppImage source={{ uri: item.uri }} style={styles.mediaTileInner} resizeMode="cover" />
      )}
      <Pressable onPress={onRemove} style={styles.removeMedia} hitSlop={6} accessibilityLabel="Remove media">
        <Ionicons name="close" size={14} color={colors.white} />
      </Pressable>
    </View>
  );
}

type MediaAction = 'camera' | 'gallery' | 'video';

function MediaActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.mediaAction, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={colors.brand} />
      <Text style={styles.mediaActionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function CreatePostScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const params = useLocalSearchParams<{ placeName?: string; placeImageUrl?: string; placeId?: string }>();

  const initialPlace = useMemo<TaggedPlace | null>(() => {
    if (!params.placeName) {
      return null;
    }
    return {
      placeId: params.placeId ?? '',
      name: params.placeName,
      imageUrl: params.placeImageUrl ?? null,
    };
  }, [params.placeId, params.placeImageUrl, params.placeName]);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [text, setText] = useState('');
  const [media, setMedia] = useState<PostMediaItem[]>([]);
  const [taggedPlace, setTaggedPlace] = useState<TaggedPlace | null>(initialPlace);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [reaction, setReaction] = useState<PostReaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      void getStoredUser().then(setUser);
    }, []),
  );

  const displayName = resolveDisplayName(user);
  const hasContent = text.trim().length > 0 || media.length > 0;
  const canPost = Boolean(taggedPlace) && hasContent && !isSubmitting;
  const showReactions = Boolean(taggedPlace);

  async function ensureMediaRoom() {
    if (media.length >= MAX_MEDIA) {
      await dialog.alert({
        title: 'Limit reached',
        message: `You can add up to ${MAX_MEDIA} photos or videos.`,
      });
      return false;
    }
    return true;
  }

  async function handlePickFromGallery(includeVideos: boolean) {
    if (!(await ensureMediaRoom())) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await dialog.alert({
        title: 'Permission required',
        message: 'Please allow photo library access to add media.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: includeVideos ? ['images', 'videos'] : ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - media.length,
      quality: 0.85,
      videoMaxDuration: 60,
      videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
    });

    if (!result.canceled) {
      const picked = await Promise.all(result.assets.map(assetToMediaItem));
      setMedia((prev) => [...prev, ...picked].slice(0, MAX_MEDIA));
    }
  }

  async function handleCaptureMedia() {
    if (!(await ensureMediaRoom())) {
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      await dialog.alert({
        title: 'Camera access',
        message: 'Allow camera access to capture photos and videos.',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      videoMaxDuration: 60,
      videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
    });

    if (!result.canceled && result.assets?.length) {
      const item = await assetToMediaItem(result.assets[0]);
      setMedia((prev) => [...prev, item].slice(0, MAX_MEDIA));
    }
  }

  function removeMedia(uri: string) {
    setMedia((prev) => prev.filter((item) => item.uri !== uri));
  }

  async function handleSubmit() {
    if (!hasContent) {
      setError('Add text or a photo/video to your post.');
      return;
    }

    if (!taggedPlace) {
      setError('Select which place you are at before posting.');
      return;
    }

    if (!canPost) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await createPost({
        text: text.trim() || undefined,
        media,
        reaction,
        placeName: taggedPlace.name,
        placeId: taggedPlace.placeId || undefined,
        placeImageUrl: taggedPlace.imageUrl ?? undefined,
        mentionedUserIds,
      });
      router.back();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to create post'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <StackScreenLayout>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>New post</Text>

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={!canPost}
          style={[styles.postButton, !canPost && styles.postButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Share post"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={[styles.postButtonText, !canPost && styles.postButtonTextDisabled]}>Post</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authorRow}>
            <Avatar uri={user?.profilePhotoUrl} name={displayName} size={40} />
            <View style={styles.authorText}>
              <Text style={styles.authorName}>{displayName}</Text>
              <Text style={styles.authorHint}>Select where you are to share your post</Text>
            </View>
          </View>

          <CreatePostPlaceField value={taggedPlace} onChange={setTaggedPlace} />

          <View style={styles.composerCard}>
            <CreatePostComposerInput
              value={text}
              onChange={setText}
              mentionedUserIds={mentionedUserIds}
              onMentionedUserIdsChange={setMentionedUserIds}
              placeholder={
                taggedPlace ? 'Share your experience at this place…' : "What's on your mind?"
              }
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos & videos</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaStrip}
            >
              {media.map((item) => (
                <CreatePostMediaTile key={item.uri} item={item} onRemove={() => removeMedia(item.uri)} />
              ))}
              {media.length < MAX_MEDIA ? (
                <>
                  <MediaActionButton icon="camera-outline" label="Camera" onPress={() => void handleCaptureMedia()} />
                  <MediaActionButton icon="image-outline" label="Photos" onPress={() => void handlePickFromGallery(true)} />
                  <MediaActionButton icon="videocam-outline" label="Video" onPress={() => void handlePickFromGallery(false)} />
                </>
              ) : null}
            </ScrollView>
          </View>

          {showReactions ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your take on this place</Text>
              <Text style={styles.sectionHint}>Optional reaction</Text>
              <View style={styles.reactionRow}>
                {REACTIONS.map((item) => {
                  const active = reaction === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setReaction((prev) => (prev === item.key ? null : item.key))}
                      style={[styles.reactionChip, active && styles.reactionChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={item.label}
                    >
                      <Ionicons
                        name={active ? item.activeIcon : item.icon}
                        size={20}
                        color={active ? colors.brand : colors.textSecondary}
                      />
                      <Text style={[styles.reactionLabel, active && styles.reactionLabelActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </StackScreenLayout>
  );
}

const MEDIA_TILE = 96;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  postButton: {
    minWidth: 72,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  postButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  postButtonTextDisabled: {
    color: colors.labelGray,
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 32,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorText: {
    flex: 1,
    gap: 2,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  authorHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  composerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 140,
  },
  composerInput: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    minHeight: 112,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.2,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  mediaStrip: {
    gap: 10,
    paddingVertical: 4,
  },
  mediaTile: {
    width: MEDIA_TILE,
    height: MEDIA_TILE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.inputGray,
  },
  mediaTileInner: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2530',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  removeMedia: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  mediaAction: {
    width: MEDIA_TILE,
    height: MEDIA_TILE,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mediaActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  reactionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
  },
  reactionChipActive: {
    borderColor: colors.brand,
    backgroundColor: 'rgba(82, 186, 215, 0.08)',
  },
  reactionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  reactionLabelActive: {
    color: colors.brand,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
