import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationPermissionPrompt } from './LocationPermissionPrompt';
import { NearbyPlacesCarousel } from './NearbyPlacesCarousel';
import { colors } from '../theme/colors';

type NearbySetupScreenProps = {
  onComplete: () => void;
};

export function NearbySetupScreen({ onComplete }: NearbySetupScreenProps) {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Awesome places near your area</Text>

          <NearbyPlacesCarousel />

          <LocationPermissionPrompt onGranted={onComplete} onDismiss={onComplete} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
    gap: 24,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: 24,
    lineHeight: 34,
  },
});
