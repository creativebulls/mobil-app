import { Platform, TurboModuleRegistry } from 'react-native';

/** True when react-native-maps is compiled into the native app binary. */
export function isMapsNativeModuleAvailable(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  return TurboModuleRegistry.get('RNMapsAirModule') != null;
}
