import appleSignin from 'apple-signin-auth';
import { OAuth2Client } from 'google-auth-library';

import { AppError } from '../../shared/errors/AppError';
import { AppSetting } from '../admin/app-setting.model';

const AUTH_APPLE_ENABLED = 'auth_apple_enabled';
const AUTH_APPLE_CLIENT_ID = 'auth_apple_client_id';
const AUTH_GOOGLE_ENABLED = 'auth_google_enabled';
const AUTH_GOOGLE_WEB_CLIENT_ID = 'auth_google_web_client_id';
const AUTH_GOOGLE_IOS_CLIENT_ID = 'auth_google_ios_client_id';
const AUTH_GOOGLE_ANDROID_CLIENT_ID = 'auth_google_android_client_id';
const AUTH_GOOGLE_CLIENT_SECRET = 'auth_google_client_secret';

export type AppleAuthSettings = {
  enabled: boolean;
  clientId: string | null;
};

export type GoogleAuthSettings = {
  enabled: boolean;
  webClientId: string | null;
  iosClientId: string | null;
  androidClientId: string | null;
  clientSecret: string | null;
};

function parseEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

export async function getAppleAuthSettings(): Promise<AppleAuthSettings> {
  const [enabledDoc, clientIdDoc] = await Promise.all([
    AppSetting.findOne({ key: AUTH_APPLE_ENABLED }),
    AppSetting.findOne({ key: AUTH_APPLE_CLIENT_ID }),
  ]);

  const clientId = clientIdDoc?.value?.trim() || null;

  return {
    enabled: parseEnabled(enabledDoc?.value) && Boolean(clientId),
    clientId,
  };
}

export async function getGoogleAuthSettings(): Promise<GoogleAuthSettings> {
  const [enabledDoc, webDoc, iosDoc, androidDoc, secretDoc] = await Promise.all([
    AppSetting.findOne({ key: AUTH_GOOGLE_ENABLED }),
    AppSetting.findOne({ key: AUTH_GOOGLE_WEB_CLIENT_ID }),
    AppSetting.findOne({ key: AUTH_GOOGLE_IOS_CLIENT_ID }),
    AppSetting.findOne({ key: AUTH_GOOGLE_ANDROID_CLIENT_ID }),
    AppSetting.findOne({ key: AUTH_GOOGLE_CLIENT_SECRET }),
  ]);

  const webClientId = webDoc?.value?.trim() || null;
  const iosClientId = iosDoc?.value?.trim() || null;
  const androidClientId = androidDoc?.value?.trim() || null;
  const clientSecret = secretDoc?.value?.trim() || null;

  return {
    enabled: parseEnabled(enabledDoc?.value) && Boolean(webClientId),
    webClientId,
    iosClientId,
    androidClientId,
    clientSecret,
  };
}

export async function getPublicAuthConfig(): Promise<Record<string, string>> {
  const [apple, google] = await Promise.all([getAppleAuthSettings(), getGoogleAuthSettings()]);

  const config: Record<string, string> = {
    'auth.apple.enabled': apple.enabled ? 'true' : 'false',
    'auth.google.enabled': google.enabled ? 'true' : 'false',
  };

  if (apple.clientId) {
    config['auth.apple.client_id'] = apple.clientId;
  }
  if (google.webClientId) {
    config['auth.google.web_client_id'] = google.webClientId;
  }
  if (google.iosClientId) {
    config['auth.google.ios_client_id'] = google.iosClientId;
  }
  if (google.androidClientId) {
    config['auth.google.android_client_id'] = google.androidClientId;
  }

  return config;
}

export type VerifiedAppleIdentity = {
  providerId: string;
  email: string | null;
  emailVerified: boolean;
};

export type VerifiedGoogleIdentity = {
  providerId: string;
  email: string | null;
  emailVerified: boolean;
  givenName: string | null;
  surname: string | null;
  picture: string | null;
};

export async function verifyAppleIdentityToken(idToken: string): Promise<VerifiedAppleIdentity> {
  const settings = await getAppleAuthSettings();

  if (!settings.enabled || !settings.clientId) {
    throw new AppError(503, 'Apple sign-in is not enabled', 'APPLE_AUTH_DISABLED');
  }

  try {
    const payload = await appleSignin.verifyIdToken(idToken, {
      audience: settings.clientId,
      ignoreExpiration: false,
    });

    return {
      providerId: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
    };
  } catch {
    throw new AppError(401, 'Invalid Apple sign-in token', 'INVALID_APPLE_TOKEN');
  }
}

export async function verifyGoogleIdentityToken(idToken: string): Promise<VerifiedGoogleIdentity> {
  const settings = await getGoogleAuthSettings();

  if (!settings.enabled || !settings.webClientId) {
    throw new AppError(503, 'Google sign-in is not enabled', 'GOOGLE_AUTH_DISABLED');
  }

  const audiences = [settings.webClientId, settings.iosClientId, settings.androidClientId].filter(
    (value): value is string => Boolean(value),
  );

  try {
    const client = new OAuth2Client(settings.webClientId, settings.clientSecret ?? undefined);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub) {
      throw new Error('Missing subject');
    }

    return {
      providerId: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      givenName: payload.given_name ?? null,
      surname: payload.family_name ?? null,
      picture: payload.picture ?? null,
    };
  } catch {
    throw new AppError(401, 'Invalid Google sign-in token', 'INVALID_GOOGLE_TOKEN');
  }
}

export {
  AUTH_APPLE_ENABLED,
  AUTH_APPLE_CLIENT_ID,
  AUTH_GOOGLE_ENABLED,
  AUTH_GOOGLE_WEB_CLIENT_ID,
  AUTH_GOOGLE_IOS_CLIENT_ID,
  AUTH_GOOGLE_ANDROID_CLIENT_ID,
  AUTH_GOOGLE_CLIENT_SECRET,
};
