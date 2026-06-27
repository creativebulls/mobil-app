import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { fetchFriendLocations, type FriendLocation } from '../api/profileApi';
import { getErrorMessage } from '../api/types';
import { useAppText } from '../config/ConfigProvider';
import { Avatar } from './Avatar';
import { BrandButton } from './BrandButton';
import { colors } from '../theme/colors';
import { hasLocationAccess } from '../utils/locationAccess';

const REFRESH_INTERVAL_MS = 30 * 1000;
const DEFAULT_DELTA = 0.08;

type LatLng = { latitude: number; longitude: number };

function buildRegion(points: LatLng[]): Region | null {
  if (points.length === 0) {
    return null;
  }

  if (points.length === 1) {
    return {
      ...points[0],
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA,
    };
  }

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLon = points[0].longitude;
  let maxLon = points[0].longitude;

  for (const point of points) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
  }

  const latitudeDelta = Math.max((maxLat - minLat) * 1.4, DEFAULT_DELTA);
  const longitudeDelta = Math.max((maxLon - minLon) * 1.4, DEFAULT_DELTA);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

function FriendMarker({ friend, onPress }: { friend: FriendLocation; onPress: () => void }) {
  return (
    <Marker
      coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
      onPress={onPress}
      tracksViewChanges={Platform.OS === 'android'}
    >
      <View style={styles.markerWrap}>
        <View style={styles.markerBubble}>
          <Avatar uri={friend.avatarUri} name={friend.name} size={36} presenceUserId={friend.id} />
        </View>
        <Text style={styles.markerLabel} numberOfLines={1}>
          {friend.name.split(' ')[0]}
        </Text>
      </View>
    </Marker>
  );
}

export function FriendsMapView() {
  const router = useRouter();
  const androidMapsApiKey = useAppText('maps.google_android_api_key');
  const mapRef = useRef<MapView | null>(null);
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const [myCoords, setMyCoords] = useState<LatLng | null>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const hasFitRef = useRef(false);

  const loadData = useCallback(async () => {
    setError(null);

    const granted = await hasLocationAccess();
    setLocationGranted(granted);

    if (granted) {
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setMyCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch {
        setMyCoords(null);
      }
    } else {
      setMyCoords(null);
    }

    try {
      const result = await fetchFriendLocations();
      setFriends(result.friends);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      hasFitRef.current = false;
      setIsLoading(true);
      void loadData();

      const interval = setInterval(() => {
        void loadData();
      }, REFRESH_INTERVAL_MS);

      return () => clearInterval(interval);
    }, [loadData]),
  );

  const mapPoints = useMemo(() => {
    const points: LatLng[] = friends.map((friend) => ({
      latitude: friend.latitude,
      longitude: friend.longitude,
    }));
    if (myCoords) {
      points.push(myCoords);
    }
    return points;
  }, [friends, myCoords]);

  const initialRegion = useMemo(() => {
    return (
      buildRegion(mapPoints) ?? {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      }
    );
  }, [mapPoints]);

  const fitMapToPoints = useCallback(() => {
    if (!mapRef.current || mapPoints.length === 0 || mapSize.width === 0) {
      return;
    }

    mapRef.current.fitToCoordinates(mapPoints, {
      edgePadding: { top: 80, right: 48, bottom: 120, left: 48 },
      animated: true,
    });
    hasFitRef.current = true;
  }, [mapPoints, mapSize.width]);

  const handleMapLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setMapSize({ width, height });
      if (mapReady && !hasFitRef.current && mapPoints.length > 0) {
        fitMapToPoints();
      }
    },
    [fitMapToPoints, mapPoints.length, mapReady],
  );

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    if (mapPoints.length > 0 && mapSize.width > 0) {
      fitMapToPoints();
    }
  }, [fitMapToPoints, mapPoints.length, mapSize.width]);

  async function handleEnableLocation() {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      await Linking.openSettings();
      return;
    }

    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === Location.PermissionStatus.GRANTED) {
      void loadData();
      return;
    }

    if (!current.canAskAgain) {
      await Linking.openSettings();
      return;
    }

    const result = await Location.requestForegroundPermissionsAsync();
    if (result.status === Location.PermissionStatus.GRANTED) {
      void loadData();
    } else if (!result.canAskAgain) {
      await Linking.openSettings();
    }
  }

  if (Platform.OS === 'android' && !androidMapsApiKey.trim()) {
    return (
      <View style={styles.centered}>
        <Ionicons name="map-outline" size={40} color={colors.labelGray} />
        <Text style={styles.emptyTitle}>Map not configured</Text>
        <Text style={styles.emptySubtitle}>
          Ask your admin to add the Google Maps Android API key in the admin panel, then rebuild the
          app.
        </Text>
      </View>
    );
  }

  if (locationGranted === false) {
    return (
      <View style={styles.centered}>
        <Ionicons name="location-outline" size={40} color={colors.brand} />
        <Text style={styles.emptyTitle}>Location access needed</Text>
        <Text style={styles.emptySubtitle}>
          Enable location so you can see your friends on the map and share your position with them.
        </Text>
        <BrandButton label="Enable location" onPress={() => void handleEnableLocation()} style={styles.cta} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends map</Text>
        <Pressable
          onPress={() => void loadData()}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshPressed]}
          accessibilityRole="button"
          accessibilityLabel="Refresh map"
        >
          <Ionicons name="refresh" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <View style={styles.mapContainer} onLayout={handleMapLayout}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          showsUserLocation={locationGranted === true}
          showsMyLocationButton={false}
          onMapReady={handleMapReady}
        >
          {friends.map((friend) => (
            <FriendMarker
              key={friend.id}
              friend={friend}
              onPress={() => router.push(`/user/${friend.id}`)}
            />
          ))}
        </MapView>

        {isLoading && friends.length === 0 ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : null}

        {!isLoading && friends.length === 0 ? (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyOverlayTitle}>No friends nearby yet</Text>
            <Text style={styles.emptyOverlaySubtitle}>
              Friends appear here when they share a recent location from the app.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceMutedBorder,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  refreshPressed: {
    opacity: 0.75,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  markerWrap: {
    alignItems: 'center',
    maxWidth: 72,
  },
  markerBubble: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markerLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  emptyOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
  },
  emptyOverlayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  emptyOverlaySubtitle: {
    fontSize: 14,
    color: colors.labelGray,
    lineHeight: 20,
  },
  errorBanner: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
  },
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
  cta: {
    marginTop: 8,
    minWidth: 180,
  },
});
