import { Text, type StyleProp, type TextStyle } from 'react-native';

import { colors } from '../theme/colors';

const TOKEN_PATTERN = /(#\w+|@\w+)/g;

type RichPostTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function RichPostText({ text, style, numberOfLines }: RichPostTextProps) {
  const parts = text.split(TOKEN_PATTERN);

  return (
    <Text style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
      {parts.map((part, index) => {
        if (part.startsWith('#') || part.startsWith('@')) {
          return (
            <Text key={`${part}-${index}`} style={[style, styles.token]}>
              {part}
            </Text>
          );
        }

        return part;
      })}
    </Text>
  );
}

const styles = {
  token: {
    color: colors.brand,
    fontWeight: '700' as const,
  },
};
