import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createGroup, updateGroupPhoto } from '../src/api/messagesApi';
import { fetchFriends, type FriendSummary } from '../src/api/profileApi';
import { getErrorMessage } from '../src/api/types';
import { AppImage } from '../src/components/AppImage';
import { Avatar } from '../src/components/Avatar';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { colors } from '../src/theme/colors';

export default function NewGroupScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [groupPhotoUri, setGroupPhotoUri] = useState<string | null>(null);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchFriends();
      setFriends(result.friends);
    } catch {
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return friends;
    }
    return friends.filter((friend) => friend.name.toLowerCase().includes(q));
  }, [friends, search]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handlePickPhoto() {
    if (isPickingPhoto) {
      return;
    }

    setIsPickingPhoto(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        await dialog.alert({
          title: 'Permission required',
          message: 'Please allow photo library access to set a group picture.',
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
        setGroupPhotoUri(result.assets[0].uri);
      }
    } finally {
      setIsPickingPhoto(false);
    }
  }

  async function handleCreate() {
    const name = groupName.trim();
    if (!name) {
      await dialog.alert({ title: 'Name required', message: 'Give your group a name.' });
      return;
    }
    if (selected.size === 0) {
      await dialog.alert({ title: 'Add members', message: 'Select at least one friend.' });
      return;
    }

    setIsCreating(true);
    try {
      const group = await createGroup({ name, memberIds: Array.from(selected) });
      let avatarUri = group.avatarUri;
      if (groupPhotoUri) {
        const uploaded = await updateGroupPhoto(group.id, groupPhotoUri);
        avatarUri = uploaded.avatarUri;
      }
      router.replace({
        pathname: '/chat',
        params: {
          conversationId: group.id,
          isGroup: '1',
          name: group.name,
          avatarUri: avatarUri ?? '',
        },
      });
    } catch (error) {
      await dialog.alert({
        title: 'Could not create group',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsCreating(false);
    }
  }

  const canCreate = groupName.trim().length > 0 && selected.size > 0 && !isCreating;

  return (
    <StackScreenLayout>
      <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>New group</Text>
          <Pressable onPress={handleCreate} disabled={!canCreate} hitSlop={8}>
            <Text style={[styles.createText, !canCreate && styles.createTextDisabled]}>Create</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.nameRow}>
            <Pressable
              onPress={handlePickPhoto}
              style={styles.groupPhotoButton}
              accessibilityRole="button"
              accessibilityLabel="Set group picture"
            >
              {groupPhotoUri ? (
                <AppImage source={{ uri: groupPhotoUri }} style={styles.groupPhotoImage} />
              ) : (
                <View style={styles.groupGlyph}>
                  <Ionicons name="people" size={24} color={colors.white} />
                </View>
              )}
              <View style={styles.groupPhotoBadge}>
                <Ionicons name="camera" size={12} color={colors.white} />
              </View>
            </Pressable>
            <TextInput
              style={styles.nameInput}
              placeholder="Group name"
              placeholderTextColor={colors.labelGray}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={80}
            />
          </View>

          {selected.size > 0 ? (
            <Text style={styles.selectedCount}>{selected.size} selected</Text>
          ) : null}

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.labelGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends"
              placeholderTextColor={colors.labelGray}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : friends.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={44} color={colors.labelGray} />
              <Text style={styles.emptyText}>
                Add friends first to start a group conversation.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                return (
                  <Pressable
                    onPress={() => toggle(item.id)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Avatar uri={item.avatarUri} name={item.name} size={48} />
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={16} color={colors.white} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </KeyboardAvoidingView>
    </StackScreenLayout>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  createText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.brand,
  },
  createTextDisabled: {
    color: colors.labelGray,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  groupPhotoButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'visible',
  },
  groupPhotoImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  groupPhotoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  groupGlyph: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  selectedCount: {
    paddingHorizontal: 16,
    paddingTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  loader: {
    marginTop: 30,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
});
