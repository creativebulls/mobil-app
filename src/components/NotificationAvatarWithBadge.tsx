import { Image, StyleSheet, View } from 'react-native';

import { Avatar } from './Avatar';
import { colors } from '../theme/colors';

const APP_BADGE = require('../../assets/app-icons/crave-black.png');

type NotificationAvatarWithBadgeProps = {
  uri: string | null;
  name: string;
  size?: number;
};

/** Rounded sender avatar with CRAVE app logo badge at the bottom-right corner. */
export function NotificationAvatarWithBadge({
  uri,
  name,
  size = 46,
}: NotificationAvatarWithBadgeProps) {
  const badgeSize = Math.round(size * 0.46);
  const logoSize = Math.round(badgeSize * 0.62);
  const radius = Math.round(badgeSize * 0.28);

  return (
    <View style={{ width: size, height: size }}>
      <Avatar uri={uri} name={name} size={size} />
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: radius,
            right: -3,
            bottom: -3,
          },
        ]}
      >
        <Image
          source={APP_BADGE}
          style={{ width: logoSize, height: logoSize }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
