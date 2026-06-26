import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AuthorSummary } from '../api/types';
import { Avatar } from './Avatar';
import { colors } from '../theme/colors';

const AVATAR_SIZE = 18;
const AVATAR_OVERLAP = 6;

type PostLikesPreviewProps = {
  likesCount: number;
  recentLikers: AuthorSummary[];
  onPress?: () => void;
};

function buildLikesLabel(likesCount: number, primaryName: string): string {
  if (likesCount <= 1) {
    return `Liked by ${primaryName}`;
  }

  const others = likesCount - 1;
  const othersLabel = others === 1 ? '1 other' : `${others} others`;
  return `Liked by ${primaryName} and ${othersLabel}`;
}

export function PostLikesPreview({ likesCount, recentLikers, onPress }: PostLikesPreviewProps) {
  if (likesCount <= 0) {
    return null;
  }

  const primaryLiker = recentLikers[0];
  const displayLikers = recentLikers.slice(0, 3).reverse();
  const label = primaryLiker
    ? buildLikesLabel(likesCount, primaryLiker.name)
    : `${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`;

  const content = (
    <View style={styles.row}>
      {displayLikers.length > 0 ? (
        <View style={styles.avatarStack}>
          {displayLikers.map((liker, index) => (
            <View
              key={liker.id}
              style={[
                styles.avatarWrap,
                index > 0 && { marginLeft: -AVATAR_OVERLAP },
                { zIndex: index + 1 },
              ]}
            >
              <Avatar uri={liker.avatarUri} name={liker.name} size={AVATAR_SIZE} style={styles.avatar} />
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.label} numberOfLines={2}>
        {primaryLiker ? (
          <>
            Liked by <Text style={styles.name}>{primaryLiker.name}</Text>
            {likesCount > 1 ? (
              <>
                {' and '}
                {likesCount - 1 === 1 ? '1 other' : `${likesCount - 1} others`}
              </>
            ) : null}
          </>
        ) : (
          label
        )}
      </Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`View ${likesCount} likes`}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: colors.white,
  },
  avatar: {
    borderRadius: AVATAR_SIZE / 2,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
  },
  name: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
