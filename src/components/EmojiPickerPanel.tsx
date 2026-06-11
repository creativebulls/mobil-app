import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COMMENT_EMOJIS } from '../constants/emojis';
import { colors } from '../theme/colors';

type EmojiPickerPanelProps = {
  onSelect: (emoji: string) => void;
};

export function EmojiPickerPanel({ onSelect }: EmojiPickerPanelProps) {
  return (
    <View style={styles.panel}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {COMMENT_EMOJIS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => onSelect(emoji)}
            style={({ pressed }) => [styles.emojiButton, pressed && styles.emojiPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Insert ${emoji}`}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  emojiButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  emojiPressed: {
    backgroundColor: colors.inputGray,
  },
  emoji: {
    fontSize: 26,
  },
});
