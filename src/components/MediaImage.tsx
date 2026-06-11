import { Image, type ImageProps, StyleSheet, View } from 'react-native';

import { useMediaUrl } from '../hooks/useMediaUrl';
import { colors } from '../theme/colors';

type MediaImageProps = Omit<ImageProps, 'source'> & {
  uri: string | null | undefined;
};

export function MediaImage({ uri, style, ...props }: MediaImageProps) {
  const resolvedUri = useMediaUrl(uri);

  if (!resolvedUri) {
    return <View style={[styles.placeholder, style]} />;
  }

  return <Image source={{ uri: resolvedUri }} style={style} {...props} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.inputGray,
  },
});
