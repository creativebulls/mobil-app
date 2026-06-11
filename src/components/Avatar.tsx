import { Image, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';

import { useMediaUrl } from '../hooks/useMediaUrl';
import { colors } from '../theme/colors';

type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
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

export function Avatar({ uri, name, size = 44, style }: AvatarProps) {
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  const resolvedUri = useMediaUrl(uri);

  if (resolvedUri) {
    return (
      <Image
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
});
