import type { CSSProperties, ReactEventHandler } from 'react';
import { Image as RNImage, StyleSheet, type ImageProps } from 'react-native';

/**
 * Web implementation of AppImage: renders a native DOM `<img>` so remote and
 * local images always paint, regardless of react-native-web's Image internals.
 * RN `Image` styles/props are mapped onto the `<img>` (resizeMode -> objectFit,
 * accessibilityLabel -> alt, etc.).
 */

const OBJECT_FIT: Record<string, CSSProperties['objectFit']> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
  repeat: 'none',
};

function sourceToUri(source: ImageProps['source']): string | undefined {
  if (!source) {
    return undefined;
  }
  if (Array.isArray(source)) {
    for (const entry of source) {
      const uri = sourceToUri(entry);
      if (uri) {
        return uri;
      }
    }
    return undefined;
  }
  if (typeof source === 'number') {
    return RNImage.resolveAssetSource(source)?.uri;
  }
  if (typeof source === 'object' && 'uri' in source) {
    return (source as { uri?: string }).uri;
  }
  return undefined;
}

export function AppImage({
  source,
  style,
  resizeMode,
  accessibilityLabel,
  onLoad,
  onError,
}: ImageProps) {
  const uri = sourceToUri(source);

  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const { resizeMode: styleResizeMode, tintColor: _tintColor, overlayColor: _overlay, ...rest } =
    flat;

  const fit =
    OBJECT_FIT[(resizeMode as string) ?? (styleResizeMode as string) ?? 'cover'] ?? 'cover';

  const cssStyle: CSSProperties = {
    ...(rest as CSSProperties),
    objectFit: fit,
    display: 'block',
  };

  // Preserve layout space even when there's no source (mirrors RN behaviour of
  // an empty image box) instead of showing a broken-image icon.
  if (!uri) {
    return <div style={cssStyle} aria-hidden />;
  }

  return (
    <img
      src={uri}
      alt={accessibilityLabel ?? ''}
      style={cssStyle}
      draggable={false}
      onLoad={onLoad as unknown as ReactEventHandler<HTMLImageElement>}
      onError={onError as unknown as ReactEventHandler<HTMLImageElement>}
    />
  );
}

export type { ImageProps };
