import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ActivityIndicator,
  Image,
  Linking,
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

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) {
    return '';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function fileIconFor(media: MessageMedia): keyof typeof Ionicons.glyphMap {
  const mime = media.mimeType ?? '';
  const name = (media.fileName ?? '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return 'document-text';
  }
  if (mime.includes('zip') || mime.includes('compressed') || /\.(zip|rar|7z|gz)$/.test(name)) {
    return 'file-tray-full';
  }
  if (mime.includes('sheet') || mime.includes('excel') || /\.(xls|xlsx|csv)$/.test(name)) {
    return 'grid';
  }
  if (mime.startsWith('image/')) {
    return 'image';
  }
  return 'document';
}

function AudioMessageBubble({ media }: { media: MessageMedia }) {
  const resolved = useMediaUrl(media.url);
  const player = useAudioPlayer(resolved ?? undefined);
  const status = useAudioPlayerStatus(player);

  const totalSeconds = status.duration || (media.durationMs ? media.durationMs / 1000 : 0);
  const elapsed = status.currentTime || 0;
  const progress = totalSeconds > 0 ? Math.min(elapsed / totalSeconds, 1) : 0;
  const remaining = totalSeconds > 0 ? Math.max(totalSeconds - elapsed, 0) : 0;

  const toggle = () => {
    if (!resolved) {
      return;
    }
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (totalSeconds > 0 && elapsed >= totalSeconds)) {
      player.seekTo(0);
    }
    player.play();
  };

  return (
    <View style={styles.audioBubble}>
      <Pressable onPress={toggle} hitSlop={8} style={styles.audioPlayButton}>
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={20}
          color={colors.white}
          style={status.playing ? undefined : styles.audioPlayIcon}
        />
      </Pressable>
      <View style={styles.audioBody}>
        <View style={styles.audioTrack}>
          <View style={[styles.audioProgress, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.audioTime}>
          {status.playing || elapsed > 0 ? formatClock(elapsed) : formatClock(remaining || totalSeconds)}
        </Text>
      </View>
    </View>
  );
}

function FileMessageBubble({ media }: { media: MessageMedia }) {
  const resolved = useMediaUrl(media.url);
  const meta = formatBytes(media.fileSize);

  return (
    <Pressable
      onPress={() => {
        if (resolved) {
          void Linking.openURL(resolved);
        }
      }}
      style={({ pressed }) => [styles.fileBubble, pressed && styles.pressed]}
    >
      <View style={styles.fileIcon}>
        <Ionicons name={fileIconFor(media)} size={22} color={colors.brand} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {media.fileName ?? 'Attachment'}
        </Text>
        <Text style={styles.fileMeta}>{meta ? `${meta} · Tap to open` : 'Tap to open'}</Text>
      </View>
      <Ionicons name="download-outline" size={20} color={colors.labelGray} />
    </Pressable>
  );
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

  if (media.mediaType === 'audio') {
    return <AudioMessageBubble media={media} />;
  }

  if (media.mediaType === 'file') {
    return <FileMessageBubble media={media} />;
  }

  return (
    <Pressable
      onPress={() =>
        resolved &&
        onOpen({ uri: resolved, mediaType: media.mediaType === 'video' ? 'video' : 'image' })
      }
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
  audioBubble: {
    width: BUBBLE_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.inputGray,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  audioPlayIcon: {
    marginLeft: 2,
  },
  audioBody: {
    flex: 1,
    gap: 6,
  },
  audioTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    overflow: 'hidden',
  },
  audioProgress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  audioTime: {
    fontSize: 12,
    color: colors.labelGray,
    fontVariant: ['tabular-nums'],
  },
  fileBubble: {
    width: BUBBLE_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.inputGray,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  fileMeta: {
    fontSize: 12,
    color: colors.labelGray,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
