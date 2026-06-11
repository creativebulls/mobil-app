import * as Location from 'expo-location';

export async function hasLocationAccess(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    return false;
  }

  const { status } = await Location.getForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}
