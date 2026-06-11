import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDialog } from './dialog/DialogProvider';
import { colors } from '../theme/colors';

const PROFILE_PHOTO_SIZE = 88;

type ProfilePhotoPickerProps = {
  value: string | null;
  onChange: (uri: string | null) => void;
};

export function ProfilePhotoPicker({ value, onChange }: ProfilePhotoPickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const dialog = useDialog();

  async function handlePickPhoto() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        await dialog.alert({
          title: 'Permission required',
          message: 'Please allow photo library access to upload a profile picture.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        onChange(result.assets[0].uri);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Pressable
      style={styles.container}
      onPress={handlePickPhoto}
      accessibilityRole="button"
      accessibilityLabel="Edit profile picture"
    >
      <View style={styles.photoCircle}>
        {value ? (
          <Image source={{ uri: value }} style={styles.photoImage} resizeMode="cover" />
        ) : (
          <Ionicons name="person" size={40} color={colors.labelGray} />
        )}
      </View>
      <Text style={styles.editLabel}>{isLoading ? 'Opening…' : 'Edit picture'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  photoCircle: {
    width: PROFILE_PHOTO_SIZE,
    height: PROFILE_PHOTO_SIZE,
    borderRadius: PROFILE_PHOTO_SIZE / 2,
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.labelGray,
  },
});
