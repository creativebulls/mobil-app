import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { authStyles } from '../theme/authStyles';
import { colors } from '../theme/colors';

export function AuthLockIcon() {
  return (
    <View style={authStyles.lockIconCircle}>
      <Ionicons name="lock-closed" size={40} color={colors.labelGray} accessibilityLabel="Lock icon" />
    </View>
  );
}
