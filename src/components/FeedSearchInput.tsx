import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors } from '../theme/colors';

type FeedSearchInputProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  onSubmit?: (text: string) => void;
};

export function FeedSearchInput({
  value,
  onChangeText,
  placeholder = 'Search places, people…',
  onSubmit,
}: FeedSearchInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const query = value ?? internalValue;

  function handleChangeText(text: string) {
    if (value === undefined) {
      setInternalValue(text);
    }
    onChangeText?.(text);
  }

  function handleClearPress() {
    handleChangeText('');
    onSubmit?.('');
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, isFocused && styles.containerFocused]}>
        <Ionicons
          name="search-outline"
          size={20}
          color={isFocused ? colors.brand : colors.labelGray}
          style={styles.searchIcon}
        />

        <TextInput
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.labelGray}
          style={styles.input}
          returnKeyType="search"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={() => onSubmit?.(query)}
          accessibilityLabel="Search feed"
        />

        {query.length > 0 ? (
          <Pressable
            onPress={handleClearPress}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.labelGray} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  containerFocused: {
    borderColor: colors.brand,
    backgroundColor: colors.white,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
});
