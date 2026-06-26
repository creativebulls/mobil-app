import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '../api/types';
import { filterPostsByProfileTab, type ProfilePostTab } from '../utils/postMedia';
import { ProfilePostsGrid } from './ProfilePostsGrid';
import { ProfileTextPostsList } from './ProfileTextPostsList';
import { colors } from '../theme/colors';

const TABS: {
  key: ProfilePostTab;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  empty: string;
}[] = [
  {
    key: 'images',
    icon: 'grid-outline',
    activeIcon: 'grid',
    label: 'Photos',
    empty: 'No photo posts yet.',
  },
  {
    key: 'videos',
    icon: 'play-circle-outline',
    activeIcon: 'play-circle',
    label: 'Videos',
    empty: 'No video posts yet.',
  },
  {
    key: 'text',
    icon: 'document-text-outline',
    activeIcon: 'document-text',
    label: 'Text',
    empty: 'No text posts yet.',
  },
];

type ProfilePostsSectionProps = {
  posts: Post[];
  onPostPress: (post: Post) => void;
};

export function ProfilePostsSection({ posts, onPostPress }: ProfilePostsSectionProps) {
  const [activeTab, setActiveTab] = useState<ProfilePostTab>('images');

  const filteredPosts = useMemo(
    () => filterPostsByProfileTab(posts, activeTab),
    [posts, activeTab],
  );

  const activeMeta = TABS.find((tab) => tab.key === activeTab)!;

  return (
    <View style={styles.section}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={24}
                color={isActive ? colors.text : colors.labelGray}
              />
              {isActive ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>

      {posts.length === 0 ? (
        <Text style={styles.empty}>No posts yet.</Text>
      ) : filteredPosts.length === 0 ? (
        <Text style={styles.empty}>{activeMeta.empty}</Text>
      ) : activeTab === 'text' ? (
        <ProfileTextPostsList posts={filteredPosts} onPostPress={onPostPress} />
      ) : (
        <ProfilePostsGrid posts={filteredPosts} onPostPress={onPostPress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 1.5,
    backgroundColor: colors.text,
    borderRadius: 1,
  },
  empty: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  pressed: {
    opacity: 0.7,
  },
});
