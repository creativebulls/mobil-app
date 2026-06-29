import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchFriendLocations, type FriendLocation } from '../api/profileApi';
import type { Place } from '../api/types';
import { useAppText } from '../config/ConfigProvider';
import { useMapMarkerAssets } from '../hooks/useMapMarkerAssets';
import { usePlaceMapPhotos } from '../hooks/usePlaceMapPhotos';
import { usePlaces } from '../hooks/usePlaces';
import { useUnreadMessageCount } from '../hooks/useUnreadMessageCount';
import { getStoredUser } from '../storage/authSession';
import {
  MAP_FILTER_TABS,
  placeMatchesMapTab,
  showsFriendsOnMap,
  showsPlacesOnMap,
  type MapFilterTab,
} from '../utils/mapPlaceCategories';
import { BrandButton } from './BrandButton';
import { FeedHeader } from './FeedHeader';
import { FeedHeaderActions } from './FeedHeaderActions';
import { colors } from '../theme/colors';

const REFRESH_INTERVAL_MS = 30 * 1000;
const DEFAULT_MAP_ZOOM = 16;
const MIN_MAP_ZOOM = 10;
const MAX_MAP_ZOOM = 20;
const PLACE_MARKER_SIZE = 40;
const MAP_PLACES_LIMIT = 30;

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

function FriendMarker({
  friend,
  avatarUrl,
  freezeSnapshot,
  onPress,
}: {
  friend: FriendLocation;
  avatarUrl: string | null;
  freezeSnapshot: boolean;
  onPress: () => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={Platform.OS === 'android' && !freezeSnapshot}
    >
      <View style={styles.markerWrap} collapsable={false}>
        <View style={styles.markerBubble} collapsable={false}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.meMarkerImage} resizeMode="cover" />
          ) : (
            <View style={[styles.meMarkerImage, styles.meMarkerPlaceholder]} collapsable={false}>
              <Text style={styles.meMarkerInitials}>{getInitials(friend.name)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.markerLabel} numberOfLines={1}>
          {friend.name.split(' ')[0]}
        </Text>
      </View>
    </Marker>
  );
}

function MapAppHeader({ messagesBadge }: { messagesBadge: number }) {
  return (
    <View style={styles.appHeaderClip}>
      <FeedHeader showActions={false} messagesBadge={messagesBadge} />
      <View style={styles.appHeaderFloatingActions}>
        <FeedHeaderActions side="both" messagesBadge={messagesBadge} />
      </View>
    </View>
  );
}

function MapFilterTabs({
  activeTab,
  onChange,
}: {
  activeTab: MapFilterTab;
  onChange: (tab: MapFilterTab) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsRow}
      style={styles.tabsScroll}
    >
      {MAP_FILTER_TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.tabChip,
              active && styles.tabChipActive,
              pressed && styles.tabChipPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
  const unreadMessages = useUnreadMessageCount();
  const androidMapsApiKey = useAppText('maps.google_android_api_key');
  const iosMapsApiKey = useAppText('maps.google_ios_api_key');
  const googleMapsConfigured =
    Platform.OS === 'android' ? androidMapsApiKey.trim().length > 0 : iosMapsApiKey.trim().length > 0;
  const mapZoomRaw = useAppText('maps.default_zoom', String(DEFAULT_MAP_ZOOM));
  const mapZoom = useMemo(() => parseMapZoom(mapZoomRaw), [mapZoomRaw]);
  const mapRef = useRef<MapView | null>(null);
  const {
    places,
    coords,
    locationGranted,
    isLoading: placesLoading,
    refresh: refreshPlaces,
  } = usePlaces(MAP_PLACES_LIMIT);
  const [activeTab, setActiveTab] = useState<MapFilterTab>('all');
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
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
  const friendAvatarById = useMemo(() => {
    const entries: Record<string, string | null> = {};
    for (const friend of friends) {
      entries[friend.id] = friend.avatarUri;
    }
    return entries;
  }, [friends]);

  const { photoById, isLoading: photosLoading } = usePlaceMapPhotos(mapPlaces);
  const { resolvedAvatar, resolvedPhotos, resolvedFriendAvatars, isReady: assetsReady } =
    useMapMarkerAssets(me?.avatarUri, photoById, placeIds, friendAvatarById);

  const visibleFriends = useMemo(() => {
    if (!showsFriendsOnMap(activeTab)) {
      return [];
    }
    return friends;
  }, [activeTab, friends]);

  const visiblePlaces = useMemo(() => {
    if (!showsPlacesOnMap(activeTab)) {
      return [];
    }
    if (activeTab === 'all') {
      return mapPlaces;
    }
    return mapPlaces.filter((place) => placeMatchesMapTab(place, activeTab));
  }, [activeTab, mapPlaces]);

  const loadFriends = useCallback(async () => {
    try {
      const result = await fetchFriendLocations();
      setFriends(result.friends);
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const dataReady =
    meLoaded &&
    !placesLoading &&
    !photosLoading &&
    !friendsLoading &&
    assetsReady &&
    (myCoords !== null || locationGranted);

  const screenReady = dataReady && mapReady;

  useEffect(() => {
    if (mapReady) {
      return;
    }

    const timer = setTimeout(() => {
      setMapReady(true);
    }, Platform.OS === 'ios' ? 5000 : 8000);

    return () => clearTimeout(timer);
  }, [mapReady]);

  useEffect(() => {
    if (!screenReady) {
      setFreezeMarkerSnapshots(false);
      return;
    }

    setFreezeMarkerSnapshots(false);
    const timer = setTimeout(() => setFreezeMarkerSnapshots(true), Platform.OS === 'android' ? 2000 : 400);
    return () => clearTimeout(timer);
  }, [activeTab, screenReady, resolvedAvatar, resolvedPhotos, resolvedFriendAvatars, visibleFriends, visiblePlaces]);

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
    setFriendsLoading(true);
    refreshPlaces();
    void loadFriends();
  }, [loadFriends, refreshPlaces]);

  useFocusEffect(
    useCallback(() => {
      hasFocusedUserRef.current = false;
      setFriendsLoading(true);
      refreshPlaces();
      void loadFriends();

      const interval = setInterval(() => {
        refreshPlaces();
        void loadFriends();
      }, REFRESH_INTERVAL_MS);

      return () => clearInterval(interval);
    }, [loadFriends, refreshPlaces]),
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

  if (!googleMapsConfigured) {
    return (
      <View style={styles.root}>
        <MapAppHeader messagesBadge={unreadMessages} />
        <View style={styles.centered}>
          <Ionicons name="map-outline" size={40} color={colors.labelGray} />
          <Text style={styles.emptyTitle}>Map not configured</Text>
          <Text style={styles.emptySubtitle}>
            Ask your admin to add the Google Maps {Platform.OS === 'android' ? 'Android' : 'iOS'} API
            key in the admin panel, then rebuild the app.
          </Text>
        </View>
      </View>
    );
  }

  if (locationGranted === false) {
    return (
      <View style={styles.root}>
        <MapAppHeader messagesBadge={unreadMessages} />
        <View style={styles.centered}>
          <Ionicons name="location-outline" size={40} color={colors.brand} />
          <Text style={styles.emptyTitle}>Location access needed</Text>
          <Text style={styles.emptySubtitle}>
            Enable location to see nearby places on the map and your profile marker.
          </Text>
          <BrandButton label="Enable location" onPress={() => void handleEnableLocation()} style={styles.cta} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.screenContent} pointerEvents={screenReady ? 'auto' : 'none'}>
        <View style={styles.mapHeader}>
          <MapAppHeader messagesBadge={unreadMessages} />
          <View style={styles.tabsToolbar}>
            <View style={styles.tabsFlex}>
              <MapFilterTabs activeTab={activeTab} onChange={setActiveTab} />
            </View>
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
        </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={googleMapsConfigured ? PROVIDER_GOOGLE : undefined}
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
            ? visibleFriends.map((friend) => (
                <FriendMarker
                  key={friend.id}
                  friend={friend}
                  avatarUrl={resolvedFriendAvatars[friend.id] ?? null}
                  freezeSnapshot={freezeMarkerSnapshots}
                  onPress={() => router.push(`/user/${friend.id}`)}
                />
              ))
            : null}
          {screenReady
            ? visiblePlaces.map((place) => (
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

        {screenReady && visibleFriends.length === 0 && visiblePlaces.length === 0 ? (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyOverlayTitle}>Nothing to show</Text>
            <Text style={styles.emptyOverlaySubtitle}>
              {activeTab === 'friends' || activeTab === 'all'
                ? 'Friends appear when they share a recent location. Try another tab for nearby places.'
                : `No nearby ${activeTab} found. Try the All or Friends tab.`}
            </Text>
          </View>
        ) : null}
      </View>
      </View>

      {!dataReady ? (
        <Modal visible animationType="fade" transparent={false} statusBarTranslucent={false}>
          <SafeAreaView style={styles.loaderScreen} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.loaderContent}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={styles.loaderTitle}>Loading map</Text>
              <Text style={styles.loaderSubtitle}>Fetching places and photos…</Text>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
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
  loaderScreen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loaderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  mapHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceMutedBorder,
    backgroundColor: colors.white,
  },
  appHeaderClip: {
    height: 56,
    position: 'relative',
    backgroundColor: colors.white,
  },
  appHeaderFloatingActions: {
    position: 'absolute',
    right: 20,
    top: 8,
  },
  tabsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    gap: 4,
  },
  tabsFlex: {
    flex: 1,
    minWidth: 0,
  },
  tabsScroll: {
    flexGrow: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 2,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
  },
  tabChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  tabChipPressed: {
    opacity: 0.85,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  tabChipTextActive: {
    color: colors.white,
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
