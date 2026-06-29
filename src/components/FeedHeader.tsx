import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppImage } from './AppImage';
import { FeedHeaderActions } from './FeedHeaderActions';

import { colors } from '../theme/colors';

type FeedHeaderProps = {
  title?: string;
  /** When false, hides the centered/left title (logo + actions only). */
  showTitle?: boolean;
  onNotificationsPress?: () => void;
  onMessagesPress?: () => void;
  onAddPress?: () => void;
  onCallsPress?: () => void;
  /** Hide the messages shortcut (e.g. on the messages screen itself). */
  showMessages?: boolean;
  /** Hide notification/messages shortcuts (e.g. home feed renders them beside search). */
  showActions?: boolean;
  messagesBadge?: number;
  /** Render the title left-aligned beside the logo instead of centered. */
  alignTitleLeft?: boolean;
};

export function FeedHeader({
  title = 'My Feed',
  showTitle = true,
  onNotificationsPress,
  onMessagesPress,
  onAddPress,
  onCallsPress,
  showMessages = true,
  showActions = true,
  messagesBadge = 0,
  alignTitleLeft = false,
}: FeedHeaderProps) {
  const router = useRouter();

  function handleAddPress() {
    if (onAddPress) {
      onAddPress();
      return;
    }
    router.push('/create-post');
  }

  return (
    <View style={styles.container}>
      <AppImage
        source={require('../../assets/black-logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Crave logo"
      />

      {showTitle ? (
        alignTitleLeft ? (
          <Text style={styles.titleLeft} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <Text style={styles.title} numberOfLines={1} pointerEvents="none">
            {title}
          </Text>
        )
      ) : null}

      <View style={styles.actions}>
        {onCallsPress ? (
          <Pressable
            onPress={onCallsPress}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Call history"
          >
            <Ionicons name="call-outline" size={19} color={colors.text} />
          </Pressable>
        ) : null}

        {showActions ? (
          <FeedHeaderActions
            side="both"
            messagesBadge={messagesBadge}
            showMessages={showMessages}
            onNotificationsPress={onNotificationsPress}
            onMessagesPress={onMessagesPress}
          />
        ) : null}

        {onAddPress ? (
          <Pressable
            onPress={handleAddPress}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Create"
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 56,
  },
  logo: {
    width: 32,
    height: 32,
  },
  title: {
    position: 'absolute',
    left: 72,
    right: 72,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  titleLeft: {
    flex: 1,
    marginLeft: 12,
    textAlign: 'left',
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
