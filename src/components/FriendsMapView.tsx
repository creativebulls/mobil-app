import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import type { Place } from '../api/types';
import { useAppText } from '../config/ConfigProvider';
import { useMapMarkerAssets } from '../hooks/useMapMarkerAssets';
import { usePlaceMapPhotos } from '../hooks/usePlaceMapPhotos';
import { usePlaces } from '../hooks/usePlaces';
import { getStoredUser } from '../storage/authSession';
import { BrandButton } from './BrandButton';
import { colors } from '../theme/colors';

const REFRESH_INTERVAL_MS = 30 * 1000;
const DEFAULT_MAP_ZOOM = 16;
const MIN_MAP_ZOOM = 10;
const MAX_MAP_ZOOM = 20;
const PLACE_MARKER_SIZE = 40;
const HOME_PLACES_LIMIT = 16;

function parseMapZoom(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAP_ZOOM;
  }
  return Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, parsed));
}

function zoomToLatitudeDelta(zoom: number): number {
  return 360 / 2 ** zoom;
}

/** Hide default Google POI pins so only our place markers show. */
const MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

function profileDisplayName(user: {
  givenName: string | null;
  surname: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string {
  if (user.givenName && user.surname) {
    return `${user.givenName} ${user.surname}`;
  }
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.username ?? 'You';
}

function isValidCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

type LatLng = { latitude: number; longitude: number };

function regionForUser(coords: LatLng, zoom: number): Region {
  const delta = zoomToLatitudeDelta(zoom);
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function MeMarker({
  coordinate,
  name,
  avatarUrl,
  freezeSnapshot,
}: {
  coordinate: LatLng;
  name: string;
  avatarUrl: string | null;
  freezeSnapshot: boolean;
}) {
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={10}
      tracksViewChanges={Platform.OS === 'android' && !freezeSnapshot}
    >
      <View style={styles.markerWrap} collapsable={false}>
        <View style={[styles.markerBubble, styles.meMarkerBubble]} collapsable={false}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.meMarkerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.meMarkerImage, styles.meMarkerPlaceholder]} collapsable={false}>
              <Text style={styles.meMarkerInitials}>{getInitials(name)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.markerLabel} numberOfLines={1}>
          You
        </Text>
      </View>
    </Marker>
  );
}

function PlaceMarker({
  place,
  imageUrl,
  freezeSnapshot,
  onPress,
}: {
  place: Place;
  imageUrl: string | null;
  freezeSnapshot: boolean;
  onPress: () => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: place.lat, longitude: place.lon }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={Platform.OS === 'android' && !freezeSnapshot}
    >
      <View style={styles.placeMarkerWrap} collapsable={false}>
        <View style={styles.placeMarkerBubble} collapsable={false}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.placeMarkerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeMarkerImage, styles.placeMarkerPlaceholder]} collapsable={false}>
              <Ionicons name="storefront-outline" size={18} color={colors.brand} />
            </View>
          )}
        </View>
        <Text style={styles.placeMarkerLabel} numberOfLines={2}>
          {place.name}
        </Text>
      </View>
    </Marker>
  );
}

export function FriendsMapView() {
  const router = useRouter();
  const androidMapsApiKey = useAppText('maps.google_android_api_key');
  const mapZoomRaw = useAppText('maps.default_zoom', String(DEFAULT_MAP_ZOOM));
  const mapZoom = useMemo(() => parseMapZoom(mapZoomRaw), [mapZoomRaw]);
  const mapRef = useRef<MapView | null>(null);
  const {
    places,
    coords,
    locationGranted,
    isLoading: placesLoading,
    refresh: refreshPlaces,
  } = usePlaces(HOME_PLACES_LIMIT);
  const [me, setMe] = useState<{ name: string; avatarUri: string | null } | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [freezeMarkerSnapshots, setFreezeMarkerSnapshots] = useState(false);
  const hasFocusedUserRef = useRef(false);

  useEffect(() => {
    void getStoredUser().then((user) => {
      if (!user) {
        setMeLoaded(true);
        return;
      }
      setMe({
        name: profileDisplayName(user),
        avatarUri: user.profilePhotoUrl,
      });
      setMeLoaded(true);
    });
  }, []);

  const myCoords = useMemo<LatLng | null>(() => {
    if (!coords) {
      return null;
    }
    return { latitude: coords.lat, longitude: coords.lon };
  }, [coords]);

  /** Same list as the home feed — backend places with valid coordinates. */
  const mapPlaces = useMemo(() => {
    if (!locationGranted) {
      return [];
    }
    return places.filter((place) => isValidCoordinate(place.lat, place.lon));
  }, [places, locationGranted]);

  const placeIds = useMemo(() => mapPlaces.map((place) => place.id), [mapPlaces]);
  const { photoById, isLoading: photosLoading } = usePlaceMapPhotos(mapPlaces);
  const { resolvedAvatar, resolvedPhotos, isReady: assetsReady } = useMapMarkerAssets(
    me?.avatarUri,
    photoById,
    placeIds,
  );

  const screenReady =
    meLoaded &&
    !placesLoading &&
    !photosLoading &&
    assetsReady &&
    mapReady &&
    myCoords !== null;

  useEffect(() => {
    if (!screenReady) {
      setFreezeMarkerSnapshots(false);
      return;
    }

    setFreezeMarkerSnapshots(false);
    const timer = setTimeout(() => setFreezeMarkerSnapshots(true), Platform.OS === 'android' ? 2000 : 400);
    return () => clearTimeout(timer);
  }, [screenReady, resolvedAvatar, resolvedPhotos, mapPlaces]);

  const focusOnUser = useCallback(
    (animated = true) => {
      if (!mapRef.current || !myCoords) {
        return;
      }
      mapRef.current.animateCamera(
        {
          center: myCoords,
          zoom: mapZoom,
        },
        { duration: animated ? 450 : 0 },
      );
      hasFocusedUserRef.current = true;
    },
    [mapZoom, myCoords],
  );

  const refreshAll = useCallback(() => {
    setFreezeMarkerSnapshots(false);
    refreshPlaces();
  }, [refreshPlaces]);

  useFocusEffect(
    useCallback(() => {
      hasFocusedUserRef.current = false;
      refreshPlaces();

      const interval = setInterval(() => {
        refreshPlaces();
      }, REFRESH_INTERVAL_MS);

      return () => clearInterval(interval);
    }, [refreshPlaces]),
  );

  useEffect(() => {
    if (mapReady && myCoords && !hasFocusedUserRef.current) {
      focusOnUser(false);
    }
  }, [focusOnUser, mapReady, myCoords]);

  const initialRegion = useMemo(() => {
    if (myCoords) {
      return regionForUser(myCoords, mapZoom);
    }
    const delta = zoomToLatitudeDelta(mapZoom);
    return {
      latitude: 37.7749,
      longitude: -122.4194,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [mapZoom, myCoords]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    if (myCoords) {
      focusOnUser(false);
    }
  }, [focusOnUser, myCoords]);

  async function handleEnableLocation() {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      await Linking.openSettings();
      return;
    }

    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === Location.PermissionStatus.GRANTED) {
      refreshAll();
      return;
    }

    if (!current.canAskAgain) {
      await Linking.openSettings();
      return;
    }

    const result = await Location.requestForegroundPermissionsAsync();
    if (result.status === Location.PermissionStatus.GRANTED) {
      refreshAll();
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
          Enable location to see nearby places on the map and your profile marker.
        </Text>
        <BrandButton label="Enable location" onPress={() => void handleEnableLocation()} style={styles.cta} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {!screenReady ? (
        <View style={styles.fullScreenLoader}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loaderTitle}>Loading map</Text>
          <Text style={styles.loaderSubtitle}>Fetching places and photos…</Text>
        </View>
      ) : null}

      <View
        style={[styles.screenContent, !screenReady && styles.screenContentHidden]}
        pointerEvents={screenReady ? 'auto' : 'none'}
      >
        <View style={styles.header}>
        <Text style={styles.headerTitle}>Map</Text>
        <View style={styles.headerActions}>
          {myCoords ? (
            <Pressable
              onPress={() => focusOnUser(true)}
              style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshPressed]}
              accessibilityRole="button"
              accessibilityLabel="Center on my location"
            >
              <Ionicons name="locate" size={20} color={colors.brand} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={refreshAll}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshPressed]}
            accessibilityRole="button"
            accessibilityLabel="Refresh map"
          >
            <Ionicons name="refresh" size={20} color={colors.brand} />
          </Pressable>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          customMapStyle={MAP_STYLE}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          onMapReady={handleMapReady}
        >
          {screenReady && myCoords && me ? (
            <MeMarker
              coordinate={myCoords}
              name={me.name}
              avatarUrl={resolvedAvatar}
              freezeSnapshot={freezeMarkerSnapshots}
            />
          ) : null}
          {screenReady
            ? mapPlaces.map((place) => (
                <PlaceMarker
                  key={place.id}
                  place={place}
                  imageUrl={resolvedPhotos[place.id] ?? null}
                  freezeSnapshot={freezeMarkerSnapshots}
                  onPress={() =>
                    router.push({
                      pathname: '/place-detail',
                      params: {
                        id: place.id,
                        name: place.name,
                        imageUrl: resolvedPhotos[place.id] ?? '',
                      },
                    })
                  }
                />
              ))
            : null}
        </MapView>

        {screenReady && mapPlaces.length === 0 ? (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyOverlayTitle}>No places nearby yet</Text>
            <Text style={styles.emptyOverlaySubtitle}>
              Nearby places from the app feed will appear here on the map.
            </Text>
          </View>
        ) : null}

        {screenReady && mapPlaces.length > 0 ? (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={styles.legendDotMe} />
              <Text style={styles.legendText}>You</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDotPlace} />
              <Text style={styles.legendText}>Places</Text>
            </View>
          </View>
        ) : null}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  screenContent: {
    flex: 1,
  },
  screenContentHidden: {
    opacity: 0,
  },
  fullScreenLoader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    gap: 10,
    paddingHorizontal: 32,
  },
  loaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  loaderSubtitle: {
    fontSize: 14,
    color: colors.labelGray,
    textAlign: 'center',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  meMarkerBubble: {
    borderColor: colors.brand,
  },
  meMarkerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputGray,
  },
  meMarkerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  meMarkerInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
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
  placeMarkerWrap: {
    alignItems: 'center',
    maxWidth: 96,
  },
  placeMarkerBubble: {
    width: PLACE_MARKER_SIZE + 4,
    height: PLACE_MARKER_SIZE + 4,
    borderRadius: (PLACE_MARKER_SIZE + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: 'hidden',
  },
  placeMarkerImage: {
    width: PLACE_MARKER_SIZE,
    height: PLACE_MARKER_SIZE,
    borderRadius: PLACE_MARKER_SIZE / 2,
    backgroundColor: colors.inputGray,
  },
  placeMarkerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  placeMarkerLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  legend: {
    position: 'absolute',
    top: 12,
    left: 16,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotMe: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.white,
  },
  legendDotPlace: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.surfaceMuted,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
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
