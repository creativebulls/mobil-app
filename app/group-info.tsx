import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteGroup,
  fetchGroupDetails,
  leaveGroup,
  renameGroup,
  updateGroupPhoto,
} from '../src/api/messagesApi';
import { getErrorMessage, type GroupDetails } from '../src/api/types';
import { Avatar } from '../src/components/Avatar';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { getStoredUser } from '../src/storage/authSession';
import { colors } from '../src/theme/colors';
import { openUserProfile } from '../src/utils/openUserProfile';

export default function GroupInfoScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const conversationId = params.conversationId ?? null;

  const [details, setDetails] = useState<GroupDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) {
      return;
    }
    try {
      const [result, me] = await Promise.all([
        fetchGroupDetails(conversationId),
        getStoredUser(),
      ]);
      setDetails(result);
      setNameDraft(result.name);
      setCurrentUserId(me?.id ?? null);
    } catch (error) {
      await dialog.alert({
        title: 'Could not load group',
        message: getErrorMessage(error, 'Try again later'),
      });
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, dialog, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwner = details?.isOwner ?? false;

  async function handleChangePhoto() {
    if (!conversationId || !isOwner || isUpdatingPhoto) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await dialog.alert({
        title: 'Permission required',
        message: 'Please allow photo library access to change the group picture.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    setIsUpdatingPhoto(true);
    try {
      const uploaded = await updateGroupPhoto(conversationId, result.assets[0].uri);
      setDetails((current) => (current ? { ...current, avatarUri: uploaded.avatarUri } : current));
    } catch (error) {
      await dialog.alert({
        title: 'Could not update photo',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsUpdatingPhoto(false);
    }
  }

  async function handleSaveName() {
    if (!conversationId || !isOwner) {
      return;
    }
    const name = nameDraft.trim();
    if (!name || name === details?.name) {
      return;
    }

    setIsSavingName(true);
    try {
      const updated = await renameGroup(conversationId, name);
      setDetails((current) => (current ? { ...current, name: updated.name } : current));
    } catch (error) {
      await dialog.alert({
        title: 'Could not rename group',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleDelete() {
    if (!conversationId) {
      return;
    }
    const confirmed = await dialog.confirm({
      title: 'Delete group?',
      message: 'This permanently deletes the group and all its messages for everyone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      await deleteGroup(conversationId);
      router.replace('/messages');
    } catch (error) {
      await dialog.alert({
        title: 'Could not delete group',
        message: getErrorMessage(error, 'Try again later'),
      });
    }
  }

  async function handleLeave() {
    if (!conversationId || isLeaving) {
      return;
    }
    const confirmed = await dialog.confirm({
      title: 'Leave group?',
      message: 'You will stop receiving messages from this group.',
      confirmText: 'Leave',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setIsLeaving(true);
    try {
      await leaveGroup(conversationId);
      router.replace('/messages');
    } catch (error) {
      await dialog.alert({
        title: 'Could not leave group',
        message: getErrorMessage(error, 'Try again later'),
      });
      setIsLeaving(false);
    }
  }

  const nameChanged = isOwner && nameDraft.trim().length > 0 && nameDraft.trim() !== details?.name;

  return (
    <StackScreenLayout style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Group info</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading || !details ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.identity}>
            <Pressable
              onPress={handleChangePhoto}
              disabled={!isOwner}
              style={styles.photoButton}
              accessibilityRole="button"
              accessibilityLabel="Group picture"
            >
              {details.avatarUri ? (
                <Image source={{ uri: details.avatarUri }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoGlyph}>
                  <Ionicons name="people" size={44} color={colors.white} />
                </View>
              )}
              {isOwner ? (
                <View style={styles.photoBadge}>
                  {isUpdatingPhoto ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Ionicons name="camera" size={16} color={colors.white} />
                  )}
                </View>
              ) : null}
            </Pressable>

            {isOwner ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  maxLength={80}
                  placeholder="Group name"
                  placeholderTextColor={colors.labelGray}
                />
                {nameChanged ? (
                  <Pressable onPress={handleSaveName} disabled={isSavingName} hitSlop={8}>
                    {isSavingName ? (
                      <ActivityIndicator color={colors.brand} size="small" />
                    ) : (
                      <Text style={styles.saveName}>Save</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.groupName}>{details.name}</Text>
            )}
            <Text style={styles.memberSummary}>{details.memberCount} members</Text>
          </View>

          <Text style={styles.sectionTitle}>Members</Text>
          <View style={styles.membersCard}>
            {details.members.map((member) => (
              <Pressable
                key={member.id}
                style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}
                onPress={() => openUserProfile(router, member.id, currentUserId)}
              >
                <Avatar uri={member.avatarUri} name={member.name} size={44} online={member.isOnline} />
                <View style={styles.memberText}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.name}
                    {member.id === currentUserId ? ' (You)' : ''}
                  </Text>
                  {member.isOnline ? <Text style={styles.memberOnline}>Online</Text> : null}
                </View>
                {member.isOwner ? <Text style={styles.ownerTag}>Owner</Text> : null}
              </Pressable>
            ))}
          </View>

          {isOwner ? (
            <Pressable
              style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={styles.dangerText}>Delete group</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
              onPress={handleLeave}
              disabled={isLeaving}
            >
              <Ionicons name="exit-outline" size={20} color={colors.danger} />
              <Text style={styles.dangerText}>Leave group</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </StackScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
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
  headerSpacer: {
    width: 26,
  },
  loader: {
    marginTop: 40,
  },
  content: {
    paddingBottom: 40,
  },
  identity: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    gap: 10,
  },
  photoButton: {
    width: 96,
    height: 96,
  },
  photoImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  photoGlyph: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    minWidth: 120,
    maxWidth: 240,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 4,
  },
  saveName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.brand,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  memberSummary: {
    fontSize: 14,
    color: colors.labelGray,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.labelGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  membersCard: {
    paddingHorizontal: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  memberText: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  memberOnline: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand,
  },
  ownerTag: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.labelGray,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
});
