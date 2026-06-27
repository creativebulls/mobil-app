import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { isMapsNativeModuleAvailable } from '../utils/mapsNativeModule';

function MapsRebuildRequired() {
  return (
    <View style={styles.centered}>
      <Ionicons name="map-outline" size={40} color={colors.brand} />
      <Text style={styles.emptyTitle}>Map needs a native rebuild</Text>
      <Text style={styles.emptySubtitle}>
        react-native-maps was added after your last build. Rebuild the app once, then reopen this tab.
      </Text>
      <Text style={styles.commandHint}>
        EXPO_PUBLIC_API_URL=https://mobilevps.tech npx expo run:ios
      </Text>
    </View>
  );
}

function WebUnavailable() {
  return (
    <View style={styles.centered}>
      <Ionicons name="map-outline" size={40} color={colors.labelGray} />
      <Text style={styles.emptyTitle}>Map unavailable on web</Text>
      <Text style={styles.emptySubtitle}>Open the mobile app to see friends on the map.</Text>
    </View>
  );
}

type FriendsMapViewComponent = typeof import('./FriendsMapView').FriendsMapView;

let cachedFriendsMapView: FriendsMapViewComponent | null = null;

function getFriendsMapView(): FriendsMapViewComponent | null {
  if (!isMapsNativeModuleAvailable()) {
    return null;
  }

  if (!cachedFriendsMapView) {
    cachedFriendsMapView = require('./FriendsMapView').FriendsMapView;
  }

  return cachedFriendsMapView;
}

export function FriendsMapScreen() {
  if (Platform.OS === 'web') {
    return <WebUnavailable />;
  }

  const FriendsMapView = getFriendsMapView();
  if (!FriendsMapView) {
    return <MapsRebuildRequired />;
  }

  return <FriendsMapView />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.labelGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  commandHint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
