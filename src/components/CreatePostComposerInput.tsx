import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';

import type { FriendSummary } from '../api/profileApi';
import { fetchFriends } from '../api/profileApi';
import { Avatar } from './Avatar';
import { colors } from '../theme/colors';

type CreatePostComposerInputProps = {
  value: string;
  onChange: (text: string) => void;
  mentionedUserIds: string[];
  onMentionedUserIdsChange: (ids: string[]) => void;
  placeholder?: string;
};

export function friendMentionHandle(friend: Pick<FriendSummary, 'username' | 'name'>): string {
  if (friend.username?.trim()) {
    return friend.username.trim().toLowerCase();
  }

  const compact = friend.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return compact.slice(0, 24) || 'friend';
}

function findActiveMentionQuery(text: string, cursor: number): string | null {
  const beforeCursor = text.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
  return match ? match[1] : null;
}

export function CreatePostComposerInput({
  value,
  onChange,
  mentionedUserIds,
  onMentionedUserIdsChange,
  placeholder,
}: CreatePostComposerInputProps) {
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    void fetchFriends().then((result) => setFriends(result.friends));
  }, []);

  const mentionQuery = findActiveMentionQuery(value, selection.end);
  const showMentions = mentionQuery !== null;

  const filteredFriends = showMentions
    ? friends.filter((friend) => {
        const handle = friendMentionHandle(friend);
        const query = mentionQuery.toLowerCase();
        return handle.includes(query) || friend.name.toLowerCase().includes(query);
      }).slice(0, 8)
    : [];

  function handleSelectionChange(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) {
    setSelection(event.nativeEvent.selection);
  }

  function insertMention(friend: FriendSummary) {
    const handle = friendMentionHandle(friend);
    const cursor = selection.end;
    const beforeCursor = value.slice(0, cursor);
    const afterCursor = value.slice(cursor);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex < 0) {
      return;
    }

    const nextText = `${value.slice(0, atIndex)}@${handle} ${afterCursor}`;
    onChange(nextText);

    if (!mentionedUserIds.includes(friend.id)) {
      onMentionedUserIdsChange([...mentionedUserIds, friend.id]);
    }

    const nextCursor = atIndex + handle.length + 2;
    setSelection({ start: nextCursor, end: nextCursor });
    requestAnimationFrame(() =>
      inputRef.current?.setNativeProps({ selection: { start: nextCursor, end: nextCursor } }),
    );
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={colors.labelGray}
        style={styles.input}
        multiline
        maxLength={2000}
        textAlignVertical="top"
        autoCorrect={false}
        autoCapitalize="sentences"
      />

      <Text style={styles.hint}>Use #hashtags and @friends to tag people in your post</Text>

      {showMentions ? (
        <View style={styles.mentionPanel}>
          {filteredFriends.length === 0 ? (
            <Text style={styles.mentionEmpty}>No friends match “{mentionQuery}”</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.mentionScroll}>
              {filteredFriends.map((friend) => (
                <Pressable
                  key={friend.id}
                  onPress={() => insertMention(friend)}
                  style={({ pressed }) => [styles.mentionRow, pressed && styles.pressed]}
                >
                  <Avatar uri={friend.avatarUri} name={friend.name} size={34} />
                  <View style={styles.mentionText}>
                    <Text style={styles.mentionName} numberOfLines={1}>
                      {friend.name}
                    </Text>
                    <Text style={styles.mentionHandle}>@{friendMentionHandle(friend)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    minHeight: 112,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  mentionPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  mentionScroll: {
    maxHeight: 180,
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mentionText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  mentionHandle: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: '600',
  },
  mentionEmpty: {
    fontSize: 13,
    color: colors.textSecondary,
    padding: 14,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
