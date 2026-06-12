import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import { EmojiPickerPanel } from './EmojiPickerPanel';
import { BrandButton } from './BrandButton';
import { colors } from '../theme/colors';

type ProfileStatusEditorProps = {
  visible: boolean;
  initialStatus: string;
  onClose: () => void;
  onSave: (status: string) => Promise<void>;
};

export function ProfileStatusEditor({
  visible,
  initialStatus,
  onClose,
  onSave,
}: ProfileStatusEditorProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isSaving, setIsSaving] = useState(false);

  function handleOpen() {
    setStatus(initialStatus);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(status.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={handleOpen}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Set your status</Text>
          <TextInput
            value={status}
            onChangeText={setStatus}
            placeholder="What's on your mind? 😊"
            placeholderTextColor={colors.labelGray}
            maxLength={150}
            multiline
            style={styles.input}
          />
          <Text style={styles.counter}>{status.length}/150</Text>
          <EmojiPickerPanel
            onSelect={(emoji) => setStatus((current) => `${current}${emoji}`.slice(0, 150))}
          />
          <BrandButton
            label={isSaving ? 'Saving…' : 'Save status'}
            onPress={handleSave}
            disabled={isSaving}
            style={styles.saveButton}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: colors.labelGray,
    marginTop: 6,
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 16,
  },
});
