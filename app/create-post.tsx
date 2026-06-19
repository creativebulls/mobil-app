import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createPost } from '../src/api/postsApi';
import { getErrorMessage } from '../src/api/types';
import { AppImage } from '../src/components/AppImage';
import { Avatar } from '../src/components/Avatar';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { getStoredUser } from '../src/storage/authSession';
import type { PostReaction, UserProfile } from '../src/api/types';
import { colors } from '../src/theme/colors';

const REACTIONS: {
  key: PostReaction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'like', label: 'Like', icon: 'thumbs-up-outline', activeIcon: 'thumbs-up' },
  { key: 'dislike', label: 'Dislike', icon: 'thumbs-down-outline', activeIcon: 'thumbs-down' },
  { key: 'love', label: 'I love it', icon: 'heart-outline', activeIcon: 'heart' },
];

type PostMediaItem = { uri: string; type: 'image' | 'video' };

export default function CreatePostScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const params = useLocalSearchParams<{ placeName?: string }>();
  const isPlaceMode = Boolean(params.placeName);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [text, setText] = useState('');
  const [media, setMedia] = useState<PostMediaItem[]>([]);
  const [placeName, setPlaceName] = useState(params.placeName ?? '');
  const [reaction, setReaction] = useState<PostReaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      void getStoredUser().then(setUser);
    }, []),
  );

  const displayName =
    user?.givenName && user?.surname
      ? `${user.givenName} ${user.surname}`
      : user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.email?.split('@')[0] ?? 'You';

  const MAX_IMAGES = 6;
  const canPost = (text.trim().length > 0 || media.length > 0) && !isSubmitting;

  async function handlePickImage() {
    if (media.length >= MAX_IMAGES) {
      await dialog.alert({
        title: 'Limit reached',
        message: `You can add up to ${MAX_IMAGES} items.`,
      });
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await dialog.alert({
        title: 'Permission required',
        message: 'Please allow photo access to add photos or videos.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - media.length,
      quality: 0.85,
      videoMaxDuration: 60,
      videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
    });

    if (!result.canceled) {
      const picked: PostMediaItem[] = result.assets.map((asset) => ({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
      }));
      setMedia((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    }
  }

  async function handleCaptureMedia() {
    if (media.length >= MAX_IMAGES) {
      await dialog.alert({
        title: 'Limit reached',
        message: `You can add up to ${MAX_IMAGES} items.`,
      });
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
      const asset = result.assets[0];
      setMedia((prev) =>
        [...prev, { uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' }].slice(
          0,
          MAX_IMAGES,
        ) as PostMediaItem[],
      );
    }
  }

  function removeMedia(uri: string) {
    setMedia((prev) => prev.filter((item) => item.uri !== uri));
  }

  async function handleSubmit() {
    if (!canPost) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await createPost({
        text: text.trim() || undefined,
        media,
        reaction: isPlaceMode ? reaction : null,
        placeName: placeName.trim() || undefined,
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

          <Text style={styles.headerTitle}>New Post</Text>

          <Pressable
            onPress={handleSubmit}
            disabled={!canPost}
            style={[styles.postButton, !canPost && styles.postButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Share post"
          >
            <Text style={[styles.postButtonText, !canPost && styles.postButtonTextDisabled]}>
              Post
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.authorRow}>
              <Avatar uri={user?.profilePhotoUrl} name={displayName} size={44} />
              <Text style={styles.authorName}>{displayName}</Text>
            </View>

            {isPlaceMode ? (
              <>
                <View style={styles.placeChip}>
                  <Ionicons name="location" size={16} color={colors.brand} />
                  <Text style={styles.placeChipText} numberOfLines={1}>
                    {placeName}
                  </Text>
                </View>

                <Text style={styles.sectionLabel}>Write something about this place</Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Share the details of your experience…"
                  placeholderTextColor={colors.labelGray}
                  style={styles.detailsInput}
                  multiline
                  autoFocus
                  maxLength={2000}
                />

                <Text style={styles.sectionLabel}>Add photos or videos</Text>
                {media.length === 0 ? (
                  <View style={styles.emptyMediaRow}>
                    <Pressable
                      onPress={() => void handleCaptureMedia()}
                      style={({ pressed }) => [styles.addPhotoBox, pressed && styles.toolbarButtonPressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Capture photo or video"
                    >
                      <Ionicons name="camera" size={30} color={colors.brand} />
                      <Text style={styles.addTileText}>Camera</Text>
                    </Pressable>
                    <Pressable
                      onPress={handlePickImage}
                      style={({ pressed }) => [styles.addPhotoBox, pressed && styles.toolbarButtonPressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Add from gallery"
                    >
                      <Ionicons name="images" size={30} color={colors.brand} />
                      <Text style={styles.addTileText}>Gallery</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.tilesGrid}>
                    {media.map((item) => (
                      <View key={item.uri} style={styles.tileWrap}>
                        {item.type === 'video' ? (
                          <View style={[styles.tileImage, styles.videoTile]}>
                            <Ionicons name="play-circle" size={34} color={colors.white} />
                            <Text style={styles.videoTileLabel}>Video</Text>
                          </View>
                        ) : (
                          <AppImage source={{ uri: item.uri }} style={styles.tileImage} resizeMode="cover" />
                        )}
                        <Pressable
                          onPress={() => removeMedia(item.uri)}
                          style={styles.removeImageButton}
                          accessibilityLabel="Remove"
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={24} color={colors.white} />
                        </Pressable>
                      </View>
                    ))}

                    {media.length < MAX_IMAGES ? (
                      <Pressable
                        onPress={() => void handleCaptureMedia()}
                        style={({ pressed }) => [styles.addTile, pressed && styles.toolbarButtonPressed]}
                        accessibilityRole="button"
                        accessibilityLabel="Capture photo or video"
                      >
                        <Ionicons name="camera" size={24} color={colors.brand} />
                        <Text style={styles.addTileText}>Camera</Text>
                      </Pressable>
                    ) : null}
                    {media.length < MAX_IMAGES ? (
                      <Pressable
                        onPress={handlePickImage}
                        style={({ pressed }) => [styles.addTile, pressed && styles.toolbarButtonPressed]}
                        accessibilityRole="button"
                        accessibilityLabel="Add from gallery"
                      >
                        <Ionicons name="images" size={24} color={colors.brand} />
                        <Text style={styles.addTileText}>Gallery</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}

                <Text style={styles.sectionLabel}>What do you think of this place?</Text>
                <View style={styles.reactionRow}>
                  {REACTIONS.map((item) => {
                    const active = reaction === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setReaction((prev) => (prev === item.key ? null : item.key))}
                        style={[styles.reactionButton, active && styles.reactionButtonActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={item.label}
                      >
                        <Ionicons
                          name={active ? item.activeIcon : item.icon}
                          size={24}
                          color={active ? colors.brand : colors.textSecondary}
                        />
                        <Text style={[styles.reactionLabel, active && styles.reactionLabelActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="What's happening around you?"
                  placeholderTextColor={colors.labelGray}
                  style={styles.textInput}
                  multiline
                  autoFocus
                  maxLength={2000}
                />

                {media.length > 0 ? (
                  <View style={styles.tilesGrid}>
                    {media.map((item) => (
                      <View key={item.uri} style={styles.tileWrap}>
                        {item.type === 'video' ? (
                          <View style={[styles.tileImage, styles.videoTile]}>
                            <Ionicons name="play-circle" size={34} color={colors.white} />
                            <Text style={styles.videoTileLabel}>Video</Text>
                          </View>
                        ) : (
                          <AppImage source={{ uri: item.uri }} style={styles.tileImage} resizeMode="cover" />
                        )}
                        <Pressable
                          onPress={() => removeMedia(item.uri)}
                          style={styles.removeImageButton}
                          accessibilityLabel="Remove"
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={24} color={colors.white} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.placeRow}>
                  <Ionicons name="location-outline" size={20} color={colors.brand} />
                  <TextInput
                    value={placeName}
                    onChangeText={setPlaceName}
                    placeholder="Add a place (optional)"
                    placeholderTextColor={colors.labelGray}
                    style={styles.placeInput}
                    maxLength={120}
                  />
                </View>
              </>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.toolbar}>
            {isPlaceMode ? (
              <View />
            ) : (
              <View style={styles.toolbarButtons}>
                <Pressable
                  onPress={() => void handleCaptureMedia()}
                  style={({ pressed }) => [styles.toolbarButton, pressed && styles.toolbarButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Capture photo or video"
                >
                  <Ionicons name="camera-outline" size={24} color={colors.brand} />
                  <Text style={styles.toolbarLabel}>Camera</Text>
                </Pressable>
                <Pressable
                  onPress={handlePickImage}
                  style={({ pressed }) => [styles.toolbarButton, pressed && styles.toolbarButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Add photo or video"
                >
                  <Ionicons name="image-outline" size={24} color={colors.brand} />
                  <Text style={styles.toolbarLabel}>Gallery</Text>
                </Pressable>
              </View>
            )}

            {isSubmitting ? <ActivityIndicator color={colors.brand} /> : null}
          </View>
        </KeyboardAvoidingView>
    </StackScreenLayout>
  );
}

const styles = StyleSheet.create({
  flex: {
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
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  postButton: {
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
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
    padding: 20,
    gap: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(243, 100, 100, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  placeChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
    flexShrink: 1,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  detailsInput: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
    minHeight: 110,
    textAlignVertical: 'top',
    backgroundColor: colors.inputGray,
    borderRadius: 12,
    padding: 14,
  },
  emptyMediaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoBox: {
    flex: 1,
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 20,
    backgroundColor: colors.inputGray,
  },
  addTile: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.inputGray,
  },
  addTileText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reactionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  reactionButtonActive: {
    borderColor: colors.brand,
    backgroundColor: 'rgba(243, 100, 100, 0.1)',
  },
  reactionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  reactionLabelActive: {
    color: colors.brand,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tileWrap: {
    position: 'relative',
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.inputGray,
  },
  videoTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#1f2530',
  },
  videoTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputGray,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  placeInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  toolbarButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarButtonPressed: {
    opacity: 0.7,
  },
  toolbarLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
});
