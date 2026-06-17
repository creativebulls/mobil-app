import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Post } from '../api/types';
import { colors } from '../theme/colors';
import { Avatar } from './Avatar';
import { MediaImage } from './MediaImage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type PostImageViewerProps = {
  visible: boolean;
  images: string[];
  initialIndex: number;
  post: Post;
  likedByMe: boolean;
  likesCount: number;
  commentsCount: number;
  onLikePress: () => void;
  onCommentPress?: () => void;
  onSharePress: () => void;
  onClose: () => void;
};

export function PostImageViewer({
  visible,
  images,
  initialIndex,
  post,
  likedByMe,
  likesCount,
  commentsCount,
  onLikePress,
  onCommentPress,
  onSharePress,
  onClose,
}: PostImageViewerProps) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.root}>
        <FlatList
          data={images}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          renderItem={({ item }) => (
            <Pressable style={styles.imageWrap} onPress={onClose}>
              <MediaImage uri={item} style={styles.image} resizeMode="contain" />
            </Pressable>
          )}
        />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Avatar uri={post.author.avatarUri} name={post.author.name} size={40} />
          <View style={styles.topText}>
            <Text style={styles.authorName} numberOfLines={1}>
              {post.author.name}
            </Text>
            <Text style={styles.timeAgo} numberOfLines={1}>
              {post.timeAgo}
              {images.length > 1 ? `  ·  ${activeIndex + 1}/${images.length}` : ''}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          {post.place ? (
            <Text style={styles.placeName} numberOfLines={1}>
              <Ionicons name="location" size={13} color={colors.white} /> {post.place.name}
            </Text>
          ) : null}

          {post.text ? (
            <ScrollView style={styles.textScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.postText}>{post.text}</Text>
            </ScrollView>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable onPress={onLikePress} style={styles.action} hitSlop={8}>
              <Ionicons
                name={likedByMe ? 'heart' : 'heart-outline'}
                size={24}
                color={likedByMe ? colors.brand : colors.white}
              />
              <Text style={styles.actionText}>{likesCount}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onClose();
                onCommentPress?.();
              }}
              style={styles.action}
              hitSlop={8}
            >
              <Ionicons name="chatbubble-outline" size={22} color={colors.white} />
              <Text style={styles.actionText}>{commentsCount}</Text>
            </Pressable>

            <Pressable onPress={onSharePress} style={styles.action} hitSlop={8}>
              <Ionicons name="share-social-outline" size={22} color={colors.white} />
              <Text style={styles.actionText}>Share</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topText: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  timeAgo: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  closeButton: {
    padding: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  placeName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  textScroll: {
    maxHeight: 96,
  },
  postText: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.92)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    paddingTop: 4,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
