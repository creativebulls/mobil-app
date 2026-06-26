import { StyleSheet } from 'react-native';

import { scaleFont } from './typography';

const originalCreate = StyleSheet.create.bind(StyleSheet);

function scaleStyle<T extends Record<string, unknown>>(style: T): T {
  if (typeof style.fontSize !== 'number') {
    return style;
  }

  const scaled: T = {
    ...style,
    fontSize: scaleFont(style.fontSize),
  };

  if (typeof style.lineHeight === 'number') {
    scaled.lineHeight = scaleFont(style.lineHeight);
  }

  return scaled;
}

StyleSheet.create = function create<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const scaled = {} as T;

  for (const key of Object.keys(styles) as (keyof T)[]) {
    const style = styles[key];
    scaled[key] =
      style && typeof style === 'object'
        ? (scaleStyle(style as Record<string, unknown>) as T[keyof T])
        : style;
  }

  return originalCreate(scaled);
};
