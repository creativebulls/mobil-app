import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { authStyles } from '../theme/authStyles';
import { colors } from '../theme/colors';

export function AuthSuccessIcon() {
  return (
    <View style={authStyles.successIconCircle}>
      <Ionicons name="checkmark" size={44} color={colors.white} />
    </View>
  );
}
