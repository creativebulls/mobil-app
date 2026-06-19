import { StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';

import { AppImage } from './AppImage';
import { useMediaUrl } from '../hooks/useMediaUrl';
import { useIsOnline } from '../realtime/PresenceProvider';
import { colors } from '../theme/colors';

type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
  online?: boolean;
  /** When set, online dot updates live without re-rendering parent lists. */
  presenceUserId?: string | null;
};

function getInitials(name?: string | null): string {
  if (!name) {
    return '?';
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = 44,
  style,
  online = false,
  presenceUserId,
}: AvatarProps) {
  const liveOnline = useIsOnline(presenceUserId);
  const showOnline = presenceUserId != null ? liveOnline : online;
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  const resolvedUri = useMediaUrl(uri);

  if (!showOnline) {
    if (resolvedUri) {
      return (
        <AppImage
          source={{ uri: resolvedUri }}
          style={[dimensions, styles.image, style as ImageStyle]}
          resizeMode="cover"
        />
      );
    }

    return (
      <View style={[dimensions, styles.placeholder, style]}>
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials(name)}</Text>
      </View>
    );
  }

  const dotSize = Math.max(10, Math.round(size * 0.26));

  return (
    <View style={[{ width: size, height: size }, style]}>
      {resolvedUri ? (
        <AppImage source={{ uri: resolvedUri }} style={[dimensions, styles.image]} resizeMode="cover" />
      ) : (
        <View style={[dimensions, styles.placeholder]}>
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials(name)}</Text>
        </View>
      )}
      <View
        style={[
          styles.onlineDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            borderWidth: Math.max(1.5, dotSize * 0.16),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.inputGray,
  },
  placeholder: {
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '800',
    color: colors.brand,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#22C55E',
    borderColor: colors.white,
  },
});
