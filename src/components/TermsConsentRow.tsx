import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type TermsConsentRowProps = {
  checked: boolean;
  onToggle: () => void;
  prefix: string;
  termsLabel: string;
  conjunction: string;
  privacyLabel: string;
  termsUrl: string;
  privacyUrl: string;
  accentColor: string;
};

export function TermsConsentRow({
  checked,
  onToggle,
  prefix,
  termsLabel,
  conjunction,
  privacyLabel,
  termsUrl,
  privacyUrl,
  accentColor,
}: TermsConsentRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        style={[styles.checkbox, checked && { backgroundColor: accentColor, borderColor: accentColor }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        {checked ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </Pressable>
      <Text style={styles.label}>
        {prefix}{' '}
        <Text
          style={[styles.link, { color: accentColor }]}
          onPress={() => void Linking.openURL(termsUrl)}
        >
          {termsLabel}
        </Text>{' '}
        {conjunction}{' '}
        <Text
          style={[styles.link, { color: accentColor }]}
          onPress={() => void Linking.openURL(privacyUrl)}
        >
          {privacyLabel}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surfaceMutedBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: colors.white,
  },
  label: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  link: {
    fontWeight: '600',
  },
});
