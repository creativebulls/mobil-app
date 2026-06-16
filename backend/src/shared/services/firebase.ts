import fs from 'fs';

import { cert, deleteApp, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

import { env, isDevelopment } from '../../config/env';
import { AppSetting } from '../../modules/admin/app-setting.model';

// Admin-managed Firebase service account is stored under this settings key.
export const FIREBASE_SERVICE_ACCOUNT_KEY = 'firebase_service_account';

let app: App | null = null;
let messaging: Messaging | null = null;

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    // Support both raw JSON and base64-encoded JSON (handy for single-line env vars).
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(text) as ServiceAccount;
  } catch (error) {
    if (isDevelopment) {
      console.warn('[firebase] Failed to parse service account JSON', error);
    }
    return null;
  }
}

async function loadServiceAccount(): Promise<ServiceAccount | null> {
  // 1) Admin-managed credential stored in the database takes precedence so it
  //    can be rotated from the admin panel without redeploying the server.
  try {
    const doc = await AppSetting.findOne({ key: FIREBASE_SERVICE_ACCOUNT_KEY });
    if (doc?.value) {
      const parsed = parseServiceAccount(doc.value);
      if (parsed) {
        return parsed;
      }
    }
  } catch (error) {
    if (isDevelopment) {
      console.warn('[firebase] Failed to read service account from settings', error);
    }
  }

  // 2) Fall back to environment configuration.
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const text = fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
      return JSON.parse(text) as ServiceAccount;
    } catch (error) {
      if (isDevelopment) {
        console.warn('[firebase] Failed to read FIREBASE_SERVICE_ACCOUNT_PATH', error);
      }
      return null;
    }
  }

  return null;
}

/**
 * Returns a memoized Firebase Cloud Messaging client, or `null` when no service
 * account is configured. Push sending is best-effort: a missing credential
 * disables push rather than crashing the server.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messaging) {
    return messaging;
  }

  // Not cached yet: re-read the credential each time it's missing so a value
  // saved from the admin panel is picked up on the next send without a restart.
  const serviceAccount = await loadServiceAccount();

  if (!serviceAccount) {
    if (isDevelopment) {
      console.warn('[firebase] No service account configured; push notifications are disabled.');
    }
    return null;
  }

  // Use a uniquely-named app so it can be torn down and re-created when the
  // credential is updated from the admin panel.
  app = initializeApp({ credential: cert(serviceAccount) }, `whereabout-${Date.now()}`);
  messaging = getMessaging(app);
  return messaging;
}

/**
 * Clears the cached messaging client so the next send re-reads the (possibly
 * updated) credential. Called after the admin saves or clears the config.
 */
export async function resetFirebaseMessaging(): Promise<void> {
  messaging = null;

  if (app) {
    try {
      await deleteApp(app);
    } catch {
      // Best-effort teardown; ignore if already deleted.
    }
    app = null;
  }
}
