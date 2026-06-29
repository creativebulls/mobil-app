import { Platform } from 'react-native';

import { loginWithApple, loginWithGoogle } from '../api/authApi';
import { getAppText } from '../config/ConfigProvider';
import type { AuthResponse } from '../api/types';
import {
  configureGoogleSignInFromConfig,
  getGoogleSignInClient,
  isGoogleSignInNativeModuleAvailable,
} from './googleSignInConfig';

function isTruthy(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

async function getAppleAuthenticationModule() {
  try {
    return await import('expo-apple-authentication');
  } catch {
    return null;
  }
}

export function isAppleAuthEnabled(): boolean {
  return Platform.OS === 'ios' && isTruthy(getAppText('auth.apple.enabled'));
}

export function isGoogleAuthEnabled(): boolean {
  return isTruthy(getAppText('auth.google.enabled')) && isGoogleSignInNativeModuleAvailable();
}

/** Show Apple button in auth screens (UI preview; independent of backend/native readiness). */
export function isAppleAuthButtonVisible(): boolean {
  return Platform.OS === 'ios';
}

/** Show Google button in auth screens (UI preview; independent of backend/native readiness). */
export function isGoogleAuthButtonVisible(): boolean {
  return true;
}

export function canPerformAppleAuth(): boolean {
  return isAppleAuthEnabled();
}

export function canPerformGoogleAuth(): boolean {
  return isGoogleAuthEnabled();
}

export function canPerformSocialAuth(provider: 'apple' | 'google'): boolean {
  return provider === 'apple' ? canPerformAppleAuth() : canPerformGoogleAuth();
}

export function configureGoogleSignIn() {
  configureGoogleSignInFromConfig({
    'auth.google.web_client_id': getAppText('auth.google.web_client_id'),
    'auth.google.ios_client_id': getAppText('auth.google.ios_client_id'),
  });
}

export async function signInWithAppleAccount(): Promise<AuthResponse> {
  if (!isAppleAuthEnabled()) {
    throw new Error('Apple sign-in is not enabled');
  }

  const AppleAuthentication = await getAppleAuthenticationModule();
  if (!AppleAuthentication) {
    throw new Error('Apple sign-in is not available in this build. Rebuild the iOS app.');
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Apple sign-in is not available on this device');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token');
  }

  return loginWithApple({
    idToken: credential.identityToken,
    givenName: credential.fullName?.givenName ?? null,
    surname: credential.fullName?.familyName ?? null,
  });
}

export async function signInWithGoogleAccount(): Promise<AuthResponse> {
  if (!isTruthy(getAppText('auth.google.enabled'))) {
    throw new Error('Google sign-in is not enabled');
  }

  const GoogleSignin = getGoogleSignInClient();
  if (!GoogleSignin) {
    throw new Error('Google sign-in is not available in this build. Rebuild the iOS app.');
  }

  configureGoogleSignIn();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();

  if (response.type !== 'success') {
    throw new Error('Google sign-in was cancelled');
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an ID token');
  }

  return loginWithGoogle({ idToken });
}

export function isSocialAuthCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  if (code === 'ERR_REQUEST_CANCELED' || code === 'SIGN_IN_CANCELLED') {
    return true;
  }

  if ('type' in error && error.type === 'cancel') {
    return true;
  }

  return false;
}
