import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';

import { EmojiPickerPanel } from './EmojiPickerPanel';
import { colors } from '../theme/colors';

type CommentComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSend: () => void;
  isSending?: boolean;
  inputRef?: RefObject<TextInput | null>;
  maxLength?: number;
  sendIcon?: keyof typeof Ionicons.glyphMap;
  embedded?: boolean;
};

export function CommentComposer({
  value,
  onChangeText,
  placeholder,
  onSend,
  isSending = false,
  inputRef,
  maxLength = 1000,
  sendIcon = 'arrow-up',
  embedded = false,
}: CommentComposerProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [selection, setSelection] = useState({ start: value.length, end: value.length });

  useEffect(() => {
    setSelection((current) => {
      if (current.start <= value.length && current.end <= value.length) {
        return current;
      }
      return { start: value.length, end: value.length };
    });
  }, [value]);

  function handleSelectionChange(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) {
    setSelection(event.nativeEvent.selection);
  }

  function insertEmoji(emoji: string) {
    const start = selection.start;
    const end = selection.end;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChangeText(next);

    const cursor = start + emoji.length;
    setSelection({ start: cursor, end: cursor });
    inputRef?.current?.focus();
  }

  const canSend = value.trim().length > 0 && !isSending;

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      {showEmoji ? <EmojiPickerPanel onSelect={insertEmoji} /> : null}

      <View style={[styles.composer, embedded && styles.composerEmbedded]}>
        <Pressable
          onPress={() => setShowEmoji((open) => !open)}
          style={({ pressed }) => [styles.emojiToggle, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={showEmoji ? 'Hide emojis' : 'Add emoji'}
          hitSlop={6}
        >
          <Ionicons
            name={showEmoji ? 'happy' : 'happy-outline'}
            size={24}
            color={showEmoji ? colors.brand : colors.textSecondary}
          />
        </Pressable>

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSelectionChange={handleSelectionChange}
          selection={selection}
          placeholder={placeholder}
          placeholderTextColor={colors.labelGray}
          style={styles.input}
          multiline
          maxLength={maxLength}
        />

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          {isSending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Ionicons name={sendIcon} size={20} color={colors.white} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  wrapEmbedded: {
    borderTopWidth: 0,
    backgroundColor: 'transparent',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  composerEmbedded: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  emojiToggle: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: colors.inputGray,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  pressed: {
    opacity: 0.7,
  },
});
