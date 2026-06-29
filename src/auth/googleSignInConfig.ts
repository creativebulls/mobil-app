import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let googleSignInModule: GoogleSignInModule | null | undefined;

export function isGoogleSignInNativeModuleAvailable(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  const turboModule = TurboModuleRegistry.get?.('RNGoogleSignin');
  if (turboModule) {
    return true;
  }

  return Boolean(NativeModules.RNGoogleSignin);
}

function getGoogleSignInModule(): GoogleSignInModule | null {
  if (!isGoogleSignInNativeModuleAvailable()) {
    return null;
  }

  if (googleSignInModule !== undefined) {
    return googleSignInModule;
  }

  try {
    googleSignInModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  } catch {
    googleSignInModule = null;
  }

  return googleSignInModule;
}

export function configureGoogleSignInFromConfig(config: Record<string, string>) {
  if (!isGoogleSignInNativeModuleAvailable()) {
    return;
  }

  const webClientId = config['auth.google.web_client_id']?.trim();
  const iosClientId = config['auth.google.ios_client_id']?.trim();

  if (!webClientId) {
    return;
  }

  const module = getGoogleSignInModule();
  if (!module) {
    return;
  }

  try {
    module.GoogleSignin.configure({
      webClientId,
      iosClientId: iosClientId || undefined,
      offlineAccess: false,
    });
  } catch {
    // Native module not linked in the current dev client yet.
  }
}

export function getGoogleSignInClient() {
  return getGoogleSignInModule()?.GoogleSignin ?? null;
}
