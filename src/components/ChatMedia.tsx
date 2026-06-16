import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { MessageMedia } from '../api/types';
import { useMediaUrl } from '../hooks/useMediaUrl';
import { colors } from '../theme/colors';

const BUBBLE_WIDTH = 240;

export type OpenableMedia = { uri: string; mediaType: 'image' | 'video' };

function bubbleHeight(media: MessageMedia): number {
  if (media.width && media.height && media.width > 0) {
    const ratio = media.height / media.width;
    return Math.min(Math.max(BUBBLE_WIDTH * ratio, 120), 320);
  }
  return BUBBLE_WIDTH;
}

export function ChatMediaBubble({
  media,
  onOpen,
}: {
  media: MessageMedia;
  onOpen: (media: OpenableMedia) => void;
}) {
  const resolved = useMediaUrl(media.url);
  const height = bubbleHeight(media);

  return (
    <Pressable
      onPress={() => resolved && onOpen({ uri: resolved, mediaType: media.mediaType })}
      style={({ pressed }) => [styles.mediaBubble, { height }, pressed && styles.pressed]}
    >
      {resolved ? (
        media.mediaType === 'video' ? (
          <View style={styles.videoPreview}>
            <View style={styles.playOverlay}>
              <View style={styles.playCircle}>
                <Ionicons name="play" size={28} color={colors.white} />
              </View>
            </View>
            <View style={styles.videoTag}>
              <Ionicons name="videocam" size={12} color={colors.white} />
              <Text style={styles.videoTagText}>Video</Text>
            </View>
          </View>
        ) : (
          <Image source={{ uri: resolved }} style={styles.mediaImage} resizeMode="cover" />
        )
      ) : (
        <View style={styles.mediaLoading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )}
    </Pressable>
  );
}

function FullscreenVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <VideoView player={player} style={styles.viewerVideo} nativeControls contentFit="contain" />
  );
}

export function MediaViewerModal({
  media,
  onClose,
}: {
  media: OpenableMedia | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={media !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerRoot}>
        <Pressable style={styles.viewerClose} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={30} color={colors.white} />
        </Pressable>
        {media?.mediaType === 'video' ? (
          <FullscreenVideo uri={media.uri} />
        ) : media ? (
          <Image source={{ uri: media.uri }} style={styles.viewerImage} resizeMode="contain" />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mediaBubble: {
    width: BUBBLE_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.inputGray,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreview: {
    flex: 1,
    backgroundColor: '#1f2530',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  videoTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  videoTagText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerVideo: {
    width: '100%',
    height: '70%',
  },
  pressed: {
    opacity: 0.85,
  },
});
