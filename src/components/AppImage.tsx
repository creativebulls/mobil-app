import { Image, type ImageProps } from 'react-native';

/**
 * Cross-platform image. On native this is just React Native's `Image`. On web
 * (see `AppImage.web.tsx`) it renders a real DOM `<img>` element, which is more
 * reliable than react-native-web's background-image based `Image`.
 */
export function AppImage(props: ImageProps) {
  return <Image {...props} />;
}

export type { ImageProps };
