import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PostComment } from '../api/types';
import { Avatar } from './Avatar';
import { colors } from '../theme/colors';

type CommentItemProps = {
  comment: PostComment;
  isReply?: boolean;
  onLike: (comment: PostComment) => void;
  onReply: (comment: PostComment) => void;
};

export function CommentItem({ comment, isReply = false, onLike, onReply }: CommentItemProps) {
  return (
    <View style={[styles.row, isReply && styles.replyRow]}>
      <Avatar
        uri={comment.author.avatarUri}
        name={comment.author.name}
        size={isReply ? 30 : 38}
      />

      <View style={styles.body}>
        <View style={styles.bubble}>
          <Text style={styles.author}>{comment.author.name}</Text>
          <Text style={styles.text}>{comment.text}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.time}>{comment.timeAgo}</Text>

          <Pressable onPress={() => onReply(comment)} hitSlop={6}>
            <Text style={styles.metaAction}>Reply</Text>
          </Pressable>

          {comment.likesCount > 0 ? (
            <Text style={styles.likeCount}>
              {comment.likesCount} {comment.likesCount === 1 ? 'like' : 'likes'}
            </Text>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={() => onLike(comment)}
        style={({ pressed }) => [styles.likeButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={comment.likedByMe ? 'Unlike comment' : 'Like comment'}
        hitSlop={6}
      >
        <Ionicons
          name={comment.likedByMe ? 'heart' : 'heart-outline'}
          size={16}
          color={comment.likedByMe ? colors.brand : colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  replyRow: {
    marginLeft: 30,
    marginTop: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  bubble: {
    backgroundColor: colors.inputGray,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  author: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 4,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.labelGray,
  },
  metaAction: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.labelGray,
  },
  likeButton: {
    paddingTop: 8,
  },
  pressed: {
    opacity: 0.6,
  },
});
