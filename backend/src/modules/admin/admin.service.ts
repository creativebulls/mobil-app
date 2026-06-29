import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import { env } from '../../config/env';
import { PasswordReset } from '../auth/password-reset.model';
import { Notification } from '../notifications/notification.model';
import {
  PlaceComment,
  PlaceLike,
  PlaceVisit,
} from '../places/place-engagement.model';
import { Comment } from '../posts/comment.model';
import { Post } from '../posts/post.model';
import { PostSave } from '../posts/post-save.model';
import { User, getUserDisplayName, serializeUser } from '../users/user.model';
import { Appeal } from '../moderation/appeal.model';
import { Report } from '../moderation/report.model';
import { FriendRequest } from '../friends/friend-request.model';
import { Conversation } from '../messages/conversation.model';
import { UserRelation } from '../relations/block.model';
import { AppError } from '../../shared/errors/AppError';
import { getOnlineUserCount, isUserOnline } from '../../socket/index';
import { signAdminToken } from '../../shared/utils/jwt';
import {
  FIREBASE_SERVICE_ACCOUNT_KEY,
  getFirebaseMessaging,
  resetFirebaseMessaging,
} from '../../shared/services/firebase';
import { sendPushToUser } from '../../shared/services/push.service';
import {
  getEffectiveFoursquareKey,
  getEffectiveFoursquareProFields,
  getEffectiveGoogleKey,
  getEffectiveProvider,
  getFoursquareKeySource,
  getGoogleKeySource,
  getPlaceCategoryKeys,
  getPlacesProvider,
  setFoursquareKeyOverride,
  setFoursquareProOverride,
  setGoogleKeyOverride,
  setPlaceCategoryKeys,
  setProviderOverride,
  type PlacesProviderName,
} from '../places/places.provider';
import { listCategoryOptions, sanitizeCategoryKeys } from '../places/place.categories';
import { clearPlacesCache } from '../places/places.service';
import { AppSetting } from './app-setting.model';
import {
  AUTH_APPLE_CLIENT_ID,
  AUTH_APPLE_ENABLED,
  AUTH_GOOGLE_ANDROID_CLIENT_ID,
  AUTH_GOOGLE_CLIENT_SECRET,
  AUTH_GOOGLE_ENABLED,
  AUTH_GOOGLE_IOS_CLIENT_ID,
  AUTH_GOOGLE_WEB_CLIENT_ID,
  getAppleAuthSettings,
  getGoogleAuthSettings,
  getPublicAuthConfig,
} from '../auth/social-auth.service';

const SALT_ROUNDS = 12;

type ServiceAccountFields = {
  type?: string;
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

export async function getPushConfig() {
  const doc = await AppSetting.findOne({ key: FIREBASE_SERVICE_ACCOUNT_KEY });

  if (!doc?.value) {
    return { configured: false, projectId: null, clientEmail: null, updatedAt: null };
  }

  try {
    const parsed = JSON.parse(doc.value) as ServiceAccountFields;
    return {
      configured: true,
      projectId: parsed.project_id ?? null,
      clientEmail: parsed.client_email ?? null,
      updatedAt: doc.updatedAt,
    };
  } catch {
    return { configured: false, projectId: null, clientEmail: null, updatedAt: doc.updatedAt };
  }
}

export async function setPushConfig(rawServiceAccount: string) {
  let parsed: ServiceAccountFields;

  try {
    const text = rawServiceAccount.trim().startsWith('{')
      ? rawServiceAccount
      : Buffer.from(rawServiceAccount, 'base64').toString('utf8');
    parsed = JSON.parse(text) as ServiceAccountFields;
  } catch {
    throw new AppError(400, 'Service account must be valid JSON', 'INVALID_SERVICE_ACCOUNT');
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new AppError(
      400,
      'Service account JSON is missing required fields (project_id, client_email, private_key)',
      'INVALID_SERVICE_ACCOUNT',
    );
  }

  await AppSetting.findOneAndUpdate(
    { key: FIREBASE_SERVICE_ACCOUNT_KEY },
    { value: JSON.stringify(parsed) },
    { upsert: true, new: true },
  );

  await resetFirebaseMessaging();

  return {
    configured: true,
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
  };
}

export async function clearPushConfig() {
  await AppSetting.deleteOne({ key: FIREBASE_SERVICE_ACCOUNT_KEY });
  await resetFirebaseMessaging();
  return { configured: false };
}

const FOURSQUARE_API_KEY_SETTING = 'foursquare_api_key';
const FOURSQUARE_PRO_FIELDS_SETTING = 'foursquare_pro_fields';
const GOOGLE_API_KEY_SETTING = 'google_places_api_key';
const GOOGLE_MAPS_ANDROID_API_KEY_SETTING = 'google_maps_android_api_key';
const GOOGLE_MAPS_IOS_API_KEY_SETTING = 'google_maps_ios_api_key';
const MAP_DEFAULT_ZOOM_SETTING = 'map_default_zoom';
const DEFAULT_MAP_ZOOM = 16;
const MIN_MAP_ZOOM = 10;
const MAX_MAP_ZOOM = 20;
const PLACES_PROVIDER_SETTING = 'places_provider';
const PLACES_CATEGORIES_SETTING = 'places_category_keys';
const REGISTRATION_BUSINESS_ENABLED_SETTING = 'registration_business_enabled';
const REGISTRATION_PROGRESS_STEP_SETTING = 'registration_progress_step';
const REGISTRATION_PROGRESS_TOTAL_SETTING = 'registration_progress_total';
const DEFAULT_REGISTRATION_PROGRESS_STEP = 2;
const DEFAULT_REGISTRATION_PROGRESS_TOTAL = 4;

const VALID_PROVIDERS: PlacesProviderName[] = ['foursquare', 'google', 'opentripmap', 'sample'];

function maskKey(key: string): string {
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
}

function parseCategoryKeys(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? sanitizeCategoryKeys(parsed.map(String)) : [];
  } catch {
    return [];
  }
}

/** Loads the admin-managed places config (provider + keys + toggles) into the provider. */
export async function loadPlacesConfig(): Promise<void> {
  const [keyDoc, proDoc, googleDoc, providerDoc, categoriesDoc] = await Promise.all([
    AppSetting.findOne({ key: FOURSQUARE_API_KEY_SETTING }),
    AppSetting.findOne({ key: FOURSQUARE_PRO_FIELDS_SETTING }),
    AppSetting.findOne({ key: GOOGLE_API_KEY_SETTING }),
    AppSetting.findOne({ key: PLACES_PROVIDER_SETTING }),
    AppSetting.findOne({ key: PLACES_CATEGORIES_SETTING }),
  ]);
  setFoursquareKeyOverride(keyDoc?.value ?? null);
  setFoursquareProOverride(proDoc ? proDoc.value === 'true' : null);
  setGoogleKeyOverride(googleDoc?.value ?? null);
  setPlaceCategoryKeys(parseCategoryKeys(categoriesDoc?.value));
  const savedProvider = providerDoc?.value as PlacesProviderName | undefined;
  setProviderOverride(
    savedProvider && VALID_PROVIDERS.includes(savedProvider) ? savedProvider : null,
  );
}

export async function getPlacesConfig() {
  const [fsqDoc, googleDoc] = await Promise.all([
    AppSetting.findOne({ key: FOURSQUARE_API_KEY_SETTING }),
    AppSetting.findOne({ key: GOOGLE_API_KEY_SETTING }),
  ]);

  const fsqKey = getEffectiveFoursquareKey();
  const googleKey = getEffectiveGoogleKey();

  return {
    // Active/selected provider.
    provider: getPlacesProvider().name,
    selectedProvider: getEffectiveProvider(),
    // Foursquare (legacy top-level fields kept for backwards compatibility).
    configured: Boolean(fsqKey),
    source: getFoursquareKeySource(),
    maskedKey: fsqKey ? maskKey(fsqKey) : null,
    apiVersion: env.FOURSQUARE_API_VERSION,
    proFields: getEffectiveFoursquareProFields(),
    updatedAt: fsqDoc?.updatedAt ?? null,
    // Google Places.
    google: {
      configured: Boolean(googleKey),
      source: getGoogleKeySource(),
      maskedKey: googleKey ? maskKey(googleKey) : null,
      updatedAt: googleDoc?.updatedAt ?? null,
    },
    // Allowed place categories (empty selection = fetch all types).
    categories: {
      available: listCategoryOptions(),
      selected: getPlaceCategoryKeys(),
    },
  };
}

export async function setPlacesCategories(keys: string[]) {
  const sanitized = sanitizeCategoryKeys(keys);

  await AppSetting.findOneAndUpdate(
    { key: PLACES_CATEGORIES_SETTING },
    { value: JSON.stringify(sanitized) },
    { upsert: true, new: true },
  );

  setPlaceCategoryKeys(sanitized);
  clearPlacesCache();

  return getPlacesConfig();
}

export async function setPlacesProvider(providerName: string) {
  if (!VALID_PROVIDERS.includes(providerName as PlacesProviderName)) {
    throw new AppError(400, 'Unsupported places provider', 'INVALID_PLACES_PROVIDER');
  }

  await AppSetting.findOneAndUpdate(
    { key: PLACES_PROVIDER_SETTING },
    { value: providerName },
    { upsert: true, new: true },
  );

  setProviderOverride(providerName as PlacesProviderName);
  clearPlacesCache();

  return getPlacesConfig();
}

export async function setPlacesProFields(enabled: boolean) {
  await AppSetting.findOneAndUpdate(
    { key: FOURSQUARE_PRO_FIELDS_SETTING },
    { value: enabled ? 'true' : 'false' },
    { upsert: true, new: true },
  );

  setFoursquareProOverride(enabled);
  clearPlacesCache();

  return getPlacesConfig();
}

export async function setPlacesConfig(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new AppError(400, 'Foursquare API key is required', 'INVALID_PLACES_KEY');
  }

  await AppSetting.findOneAndUpdate(
    { key: FOURSQUARE_API_KEY_SETTING },
    { value: trimmed },
    { upsert: true, new: true },
  );

  setFoursquareKeyOverride(trimmed);
  clearPlacesCache();

  return getPlacesConfig();
}

export async function clearPlacesConfig() {
  await AppSetting.deleteOne({ key: FOURSQUARE_API_KEY_SETTING });
  setFoursquareKeyOverride(null);
  clearPlacesCache();

  return getPlacesConfig();
}

export async function setGooglePlacesConfig(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new AppError(400, 'Google Places API key is required', 'INVALID_GOOGLE_PLACES_KEY');
  }

  await AppSetting.findOneAndUpdate(
    { key: GOOGLE_API_KEY_SETTING },
    { value: trimmed },
    { upsert: true, new: true },
  );

  setGoogleKeyOverride(trimmed);
  clearPlacesCache();

  return getPlacesConfig();
}

export async function clearGooglePlacesConfig() {
  await AppSetting.deleteOne({ key: GOOGLE_API_KEY_SETTING });
  setGoogleKeyOverride(null);
  clearPlacesCache();

  return getPlacesConfig();
}

export async function getGoogleMapsAndroidApiKey(): Promise<string | null> {
  const doc = await AppSetting.findOne({ key: GOOGLE_MAPS_ANDROID_API_KEY_SETTING });
  const key = doc?.value?.trim();
  return key || null;
}

export async function getGoogleMapsIosApiKey(): Promise<string | null> {
  const doc = await AppSetting.findOne({ key: GOOGLE_MAPS_IOS_API_KEY_SETTING });
  const key = doc?.value?.trim();
  return key || null;
}

function clampMapZoom(value: number): number {
  return Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, Math.round(value)));
}

export async function getMapDefaultZoom(): Promise<number> {
  const doc = await AppSetting.findOne({ key: MAP_DEFAULT_ZOOM_SETTING });
  if (!doc?.value) {
    return DEFAULT_MAP_ZOOM;
  }
  const parsed = Number.parseInt(doc.value, 10);
  return Number.isFinite(parsed) ? clampMapZoom(parsed) : DEFAULT_MAP_ZOOM;
}

export async function getMapsConfig() {
  const [androidDoc, iosDoc, zoomDoc] = await Promise.all([
    AppSetting.findOne({ key: GOOGLE_MAPS_ANDROID_API_KEY_SETTING }),
    AppSetting.findOne({ key: GOOGLE_MAPS_IOS_API_KEY_SETTING }),
    AppSetting.findOne({ key: MAP_DEFAULT_ZOOM_SETTING }),
  ]);
  const androidKey = androidDoc?.value?.trim() || null;
  const iosKey = iosDoc?.value?.trim() || null;
  const defaultZoom = await getMapDefaultZoom();

  return {
    configured: Boolean(androidKey),
    maskedKey: androidKey ? maskKey(androidKey) : null,
    updatedAt: androidDoc?.updatedAt ?? null,
    android: {
      configured: Boolean(androidKey),
      maskedKey: androidKey ? maskKey(androidKey) : null,
      updatedAt: androidDoc?.updatedAt ?? null,
    },
    ios: {
      configured: Boolean(iosKey),
      maskedKey: iosKey ? maskKey(iosKey) : null,
      updatedAt: iosDoc?.updatedAt ?? null,
    },
    defaultZoom,
    zoomUpdatedAt: zoomDoc?.updatedAt ?? null,
  };
}

export async function setMapsConfig(input: {
  apiKey?: string;
  iosApiKey?: string;
  defaultZoom?: number;
}) {
  if (input.apiKey !== undefined) {
    const trimmed = input.apiKey.trim();
    if (!trimmed) {
      throw new AppError(400, 'Google Maps API key is required', 'INVALID_GOOGLE_MAPS_KEY');
    }
    await AppSetting.findOneAndUpdate(
      { key: GOOGLE_MAPS_ANDROID_API_KEY_SETTING },
      { value: trimmed },
      { upsert: true, new: true },
    );
  }

  if (input.iosApiKey !== undefined) {
    const trimmed = input.iosApiKey.trim();
    if (!trimmed) {
      throw new AppError(400, 'Google Maps iOS API key is required', 'INVALID_GOOGLE_MAPS_IOS_KEY');
    }
    await AppSetting.findOneAndUpdate(
      { key: GOOGLE_MAPS_IOS_API_KEY_SETTING },
      { value: trimmed },
      { upsert: true, new: true },
    );
  }

  if (input.defaultZoom !== undefined) {
    await AppSetting.findOneAndUpdate(
      { key: MAP_DEFAULT_ZOOM_SETTING },
      { value: String(clampMapZoom(input.defaultZoom)) },
      { upsert: true, new: true },
    );
  }

  if (
    input.apiKey === undefined &&
    input.iosApiKey === undefined &&
    input.defaultZoom === undefined
  ) {
    throw new AppError(400, 'Provide an API key and/or default zoom level', 'INVALID_MAPS_CONFIG');
  }

  return getMapsConfig();
}

export async function clearMapsConfig(platform: 'android' | 'ios' = 'android') {
  if (platform === 'ios') {
    await AppSetting.deleteOne({ key: GOOGLE_MAPS_IOS_API_KEY_SETTING });
  } else {
    await AppSetting.deleteOne({ key: GOOGLE_MAPS_ANDROID_API_KEY_SETTING });
  }
  return getMapsConfig();
}

function parseAuthEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

export async function getAuthConfig() {
  const [apple, google, secretDoc] = await Promise.all([
    getAppleAuthSettings(),
    getGoogleAuthSettings(),
    AppSetting.findOne({ key: AUTH_GOOGLE_CLIENT_SECRET }),
  ]);
  const [appleEnabledDoc, googleEnabledDoc] = await Promise.all([
    AppSetting.findOne({ key: AUTH_APPLE_ENABLED }),
    AppSetting.findOne({ key: AUTH_GOOGLE_ENABLED }),
  ]);
  const clientSecret = secretDoc?.value?.trim() || null;

  return {
    apple: {
      enabled: parseAuthEnabled(appleEnabledDoc?.value),
      configured: Boolean(apple.clientId),
      clientId: apple.clientId,
    },
    google: {
      enabled: parseAuthEnabled(googleEnabledDoc?.value),
      configured: Boolean(google.webClientId),
      webClientId: google.webClientId,
      iosClientId: google.iosClientId,
      androidClientId: google.androidClientId,
      maskedClientSecret: clientSecret ? maskKey(clientSecret) : null,
    },
  };
}

export async function setAuthConfig(input: {
  appleEnabled?: boolean;
  appleClientId?: string;
  googleEnabled?: boolean;
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  googleClientSecret?: string;
}) {
  if (input.appleEnabled !== undefined) {
    await AppSetting.findOneAndUpdate(
      { key: AUTH_APPLE_ENABLED },
      { value: input.appleEnabled ? 'true' : 'false' },
      { upsert: true, new: true },
    );
  }

  if (input.appleClientId !== undefined) {
    const trimmed = input.appleClientId.trim();
    if (!trimmed) {
      throw new AppError(400, 'Apple client ID is required', 'INVALID_APPLE_CLIENT_ID');
    }
    await AppSetting.findOneAndUpdate(
      { key: AUTH_APPLE_CLIENT_ID },
      { value: trimmed },
      { upsert: true, new: true },
    );
  }

  if (input.googleEnabled !== undefined) {
    await AppSetting.findOneAndUpdate(
      { key: AUTH_GOOGLE_ENABLED },
      { value: input.googleEnabled ? 'true' : 'false' },
      { upsert: true, new: true },
    );
  }

  if (input.googleWebClientId !== undefined) {
    const trimmed = input.googleWebClientId.trim();
    if (!trimmed) {
      throw new AppError(400, 'Google web client ID is required', 'INVALID_GOOGLE_WEB_CLIENT_ID');
    }
    await AppSetting.findOneAndUpdate(
      { key: AUTH_GOOGLE_WEB_CLIENT_ID },
      { value: trimmed },
      { upsert: true, new: true },
    );
  }

  if (input.googleIosClientId !== undefined) {
    const trimmed = input.googleIosClientId.trim();
    await AppSetting.findOneAndUpdate(
      { key: AUTH_GOOGLE_IOS_CLIENT_ID },
      { value: trimmed },
      { upsert: true, new: true },
    );
  }

  if (input.googleAndroidClientId !== undefined) {
    const trimmed = input.googleAndroidClientId.trim();
    await AppSetting.findOneAndUpdate(
      { key: AUTH_GOOGLE_ANDROID_CLIENT_ID },
      { value: trimmed },
      { upsert: true, new: true },
    );
  }

  if (input.googleClientSecret !== undefined) {
    const trimmed = input.googleClientSecret.trim();
    if (!trimmed) {
      throw new AppError(400, 'Google client secret cannot be empty', 'INVALID_GOOGLE_CLIENT_SECRET');
    }
    await AppSetting.findOneAndUpdate(
      { key: AUTH_GOOGLE_CLIENT_SECRET },
      { value: trimmed },
      { upsert: true, new: true },
    );
  }

  const hasUpdate =
    input.appleEnabled !== undefined ||
    input.appleClientId !== undefined ||
    input.googleEnabled !== undefined ||
    input.googleWebClientId !== undefined ||
    input.googleIosClientId !== undefined ||
    input.googleAndroidClientId !== undefined ||
    input.googleClientSecret !== undefined;

  if (!hasUpdate) {
    throw new AppError(400, 'Provide at least one auth setting to update', 'INVALID_AUTH_CONFIG');
  }

  return getAuthConfig();
}

export async function clearAuthConfig(provider: 'apple' | 'google' | 'google-secret' = 'apple') {
  if (provider === 'apple') {
    await Promise.all([
      AppSetting.deleteOne({ key: AUTH_APPLE_ENABLED }),
      AppSetting.deleteOne({ key: AUTH_APPLE_CLIENT_ID }),
    ]);
  } else if (provider === 'google') {
    await Promise.all([
      AppSetting.deleteOne({ key: AUTH_GOOGLE_ENABLED }),
      AppSetting.deleteOne({ key: AUTH_GOOGLE_WEB_CLIENT_ID }),
      AppSetting.deleteOne({ key: AUTH_GOOGLE_IOS_CLIENT_ID }),
      AppSetting.deleteOne({ key: AUTH_GOOGLE_ANDROID_CLIENT_ID }),
    ]);
  } else {
    await AppSetting.deleteOne({ key: AUTH_GOOGLE_CLIENT_SECRET });
  }

  return getAuthConfig();
}

function parseRegistrationBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function clampRegistrationTotal(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function clampRegistrationStep(value: number, total: number): number {
  return Math.min(total, Math.max(1, Math.round(value)));
}

export async function getRegistrationConfig() {
  const [businessDoc, stepDoc, totalDoc] = await Promise.all([
    AppSetting.findOne({ key: REGISTRATION_BUSINESS_ENABLED_SETTING }),
    AppSetting.findOne({ key: REGISTRATION_PROGRESS_STEP_SETTING }),
    AppSetting.findOne({ key: REGISTRATION_PROGRESS_TOTAL_SETTING }),
  ]);

  const totalStepsRaw = totalDoc?.value ? Number.parseInt(totalDoc.value, 10) : DEFAULT_REGISTRATION_PROGRESS_TOTAL;
  const totalSteps = Number.isFinite(totalStepsRaw)
    ? clampRegistrationTotal(totalStepsRaw)
    : DEFAULT_REGISTRATION_PROGRESS_TOTAL;
  const currentStepRaw = stepDoc?.value
    ? Number.parseInt(stepDoc.value, 10)
    : DEFAULT_REGISTRATION_PROGRESS_STEP;
  const currentStep = Number.isFinite(currentStepRaw)
    ? clampRegistrationStep(currentStepRaw, totalSteps)
    : DEFAULT_REGISTRATION_PROGRESS_STEP;

  return {
    businessAccountsEnabled: parseRegistrationBoolean(businessDoc?.value),
    currentStep,
    totalSteps,
    updatedAt: businessDoc?.updatedAt ?? stepDoc?.updatedAt ?? totalDoc?.updatedAt ?? null,
  };
}

export async function setRegistrationConfig(input: {
  businessAccountsEnabled?: boolean;
  currentStep?: number;
  totalSteps?: number;
}) {
  if (input.businessAccountsEnabled !== undefined) {
    await AppSetting.findOneAndUpdate(
      { key: REGISTRATION_BUSINESS_ENABLED_SETTING },
      { value: input.businessAccountsEnabled ? 'true' : 'false' },
      { upsert: true, new: true },
    );
  }

  if (input.totalSteps !== undefined) {
    await AppSetting.findOneAndUpdate(
      { key: REGISTRATION_PROGRESS_TOTAL_SETTING },
      { value: String(clampRegistrationTotal(input.totalSteps)) },
      { upsert: true, new: true },
    );
  }

  if (input.currentStep !== undefined) {
    const total = input.totalSteps ?? (await getRegistrationConfig()).totalSteps;
    await AppSetting.findOneAndUpdate(
      { key: REGISTRATION_PROGRESS_STEP_SETTING },
      { value: String(clampRegistrationStep(input.currentStep, total)) },
      { upsert: true, new: true },
    );
  }

  if (
    input.businessAccountsEnabled === undefined &&
    input.currentStep === undefined &&
    input.totalSteps === undefined
  ) {
    throw new AppError(400, 'Provide at least one registration setting', 'INVALID_REGISTRATION_CONFIG');
  }

  return getRegistrationConfig();
}

export async function getPublicRegistrationConfig(): Promise<Record<string, string>> {
  const config = await getRegistrationConfig();
  return {
    'registration.business_accounts_enabled': config.businessAccountsEnabled ? 'true' : 'false',
    'registration.progress_step': String(config.currentStep),
    'registration.progress_total': String(config.totalSteps),
  };
}

export async function getPublicAppConfig() {
  const { config, updatedAt } = await getAppConfig();
  const mapsKey = await getGoogleMapsAndroidApiKey();
  if (mapsKey) {
    config['maps.google_android_api_key'] = mapsKey;
  }
  const iosMapsKey = await getGoogleMapsIosApiKey();
  if (iosMapsKey) {
    config['maps.google_ios_api_key'] = iosMapsKey;
  }
  config['maps.default_zoom'] = String(await getMapDefaultZoom());
  Object.assign(config, await getPublicAuthConfig());
  Object.assign(config, await getPublicRegistrationConfig());
  return { config, updatedAt };
}

export async function sendTestPush(email: string) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('expoPushTokens');

  if (!user) {
    throw new AppError(404, 'No user found with that email', 'USER_NOT_FOUND');
  }

  if (user.expoPushTokens.length === 0) {
    throw new AppError(
      422,
      'That user has no registered device. Ask them to open the app once after logging in.',
      'NO_DEVICE_TOKEN',
    );
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    throw new AppError(400, 'Push is not configured yet', 'PUSH_NOT_CONFIGURED');
  }

  await sendPushToUser(user._id.toString(), {
    title: 'Crave test',
    body: 'Push notifications are working.',
    channelId: 'default',
    data: { type: 'test' },
  });

  return { sent: true, deviceCount: user.expoPushTokens.length };
}

export function adminLogin(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();

  if (
    normalizedEmail !== env.ADMIN_EMAIL.toLowerCase() ||
    password !== env.ADMIN_PASSWORD
  ) {
    throw new AppError(401, 'Invalid admin credentials', 'INVALID_CREDENTIALS');
  }

  return {
    token: signAdminToken(normalizedEmail),
    admin: { email: normalizedEmail },
  };
}

/** Dashboard metrics: live + lifetime totals across the platform. */
export async function getStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    verifiedUsers,
    completedUsers,
    suspendedUsers,
    newUsers7d,
    totalPosts,
    totalComments,
    totalConversations,
    openReports,
    pendingAppeals,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ emailVerified: true }),
    User.countDocuments({ registrationStatus: 'completed' }),
    User.countDocuments({ suspended: true }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    Post.countDocuments({}),
    Comment.countDocuments({}),
    Conversation.countDocuments({}),
    Report.countDocuments({ status: 'open' }),
    Appeal.countDocuments({ status: 'pending' }),
  ]);

  return {
    onlineUsers: getOnlineUserCount(),
    totalUsers,
    verifiedUsers,
    completedUsers,
    suspendedUsers,
    newUsers7d,
    totalPosts,
    totalComments,
    totalConversations,
    openReports,
    pendingAppeals,
  };
}

/** Per-user overview: profile, social graph counts, and content totals. */
export async function getUserDetail(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError(400, 'Invalid user id', 'INVALID_USER_ID');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const id = user._id;

  const [
    friends,
    pendingIncoming,
    pendingOutgoing,
    blockedCount,
    blockedByCount,
    restrictedCount,
    posts,
    comments,
    placeVisits,
    conversations,
  ] = await Promise.all([
    FriendRequest.countDocuments({ status: 'accepted', $or: [{ from: id }, { to: id }] }),
    FriendRequest.countDocuments({ status: 'pending', to: id }),
    FriendRequest.countDocuments({ status: 'pending', from: id }),
    UserRelation.countDocuments({ owner: id, type: 'block' }),
    UserRelation.countDocuments({ target: id, type: 'block' }),
    UserRelation.countDocuments({ owner: id, type: 'restrict' }),
    Post.countDocuments({ author: id }),
    Comment.countDocuments({ author: id }),
    PlaceVisit.countDocuments({ user: id }),
    Conversation.countDocuments({ participants: id }),
  ]);

  return {
    user: {
      ...serializeUser(user),
      displayName: getUserDisplayName(user),
      online: isUserOnline(user._id.toString()),
    },
    stats: {
      friends,
      pendingIncoming,
      pendingOutgoing,
      blocked: blockedCount,
      blockedBy: blockedByCount,
      restricted: restrictedCount,
      posts,
      comments,
      placeVisits,
      conversations,
    },
  };
}

const APP_CONFIG_KEY = 'app_config';

// Editable, app-wide text/constants the mobile client can fetch. Seeded on first
// read so the admin always has a starting point to edit.
const DEFAULT_APP_CONFIG: Record<string, string> = {
  // General
  app_name: 'Crave',
  support_email: 'support@whereabout.app',
  about_text: 'Crave helps you discover places and friends around you.',
  maintenance_message: '',
  min_supported_version: '1.0.0',

  // Theme
  // Brand / accent colour used for buttons, links and gradients across the app.
  // Must be a 6-digit hex string (e.g. #52BAD7). Takes effect on next app launch.
  'theme.brand_color': '#52BAD7',

  // Links (URLs)
  terms_url: 'https://whereabout.app/terms',
  privacy_url: 'https://whereabout.app/privacy',
  help_url: 'https://whereabout.app/help',
  website_url: 'https://whereabout.app',

  // Welcome / landing screen
  // Multiple taglines: one per line.
  'welcome.taglines': 'Discover cool new places\nShare the sports you love\nMeet with new people',
  'welcome.new_user_button': "I'm new to Crave",
  'welcome.existing_account_button': 'I have an account',
  'welcome.skip_link': 'Skip',
  'welcome.headline_lines': 'Discover.\nPlan.\nExperience.\nRemember.',
  'welcome.headline_accent_line': 'Experience.',
  'welcome.body_text':
    'Crave is your home for\nreal-life experiences\nwith the people who matter.',
  'welcome.slide2.headline_lines': 'Connect.\nExplore.\nTogether.\nAnywhere.',
  'welcome.slide2.headline_accent_line': 'Together.',
  'welcome.slide2.body_text':
    'Meet friends nearby, plan outings together,\nand turn trips and nights out into\nmemories worth sharing on Crave.',
  'welcome.slide3.headline_lines': 'Find.\nLocal spots.\nShare.\nMoments.',
  'welcome.slide3.headline_accent_line': 'Share.',
  'welcome.slide3.body_text':
    'Discover places friends love,\nexplore top-rated spots near you,\nand save the meals and moments\nyou will crave again.',
  'welcome.next_button': 'Next',

  // Splash / first-run landing screen (one tagline per line).
  'splash.taglines': 'Real experiences.\nReal people.\nRemember more.',
  'splash.get_started_button': 'Get started',
  'splash.get_started_button_color': '#FD4301',
  'splash.explore_guest_link': 'Explore as guest',

  // Sign-in screen
  'sign_in.title': 'Welcome back 👋',
  'sign_in.subtitle': 'Log in to continue your journey.',
  'sign_in.apple_button': 'Continue with Apple',
  'sign_in.google_button': 'Continue with Google',
  'sign_in.divider': 'or',
  'sign_in.login_id_label': 'Email or phone number',
  'sign_in.login_id_placeholder': 'Enter your email or phone number',
  'sign_in.password_label': 'Password',
  'sign_in.password_placeholder': 'Enter your password',
  'sign_in.forgot_password': 'Forgot password?',
  'sign_in.submit_button': 'Log in',
  'sign_in.footer_text': "Don't have an account?",
  'sign_in.register_link': 'Register',
  'sign_in.social_unavailable':
    'Social sign-in is coming soon. Use email or phone for now.',

  // Sign-up screen
  'sign_up.title': 'Create your account',
  'sign_up.subtitle': "Let's get you set up.",
  'sign_up.progress_label': 'Step {step} of {total}',
  'sign_up.apple_button': 'Continue with Apple',
  'sign_up.google_button': 'Continue with Google',
  'sign_up.email_label': 'Email',
  'sign_up.email_placeholder': 'Enter your email',
  'sign_up.password_label': 'Password',
  'sign_up.password_placeholder': 'Create a password',
  'sign_up.confirm_password_label': 'Confirm password',
  'sign_up.confirm_password_placeholder': 'Re-enter your password',
  'sign_up.password_req_length': 'At least 8 characters',
  'sign_up.password_req_number': 'Includes a number',
  'sign_up.password_req_uppercase': 'Includes an uppercase letter',
  'sign_up.account_type_label': 'I am',
  'sign_up.individual_label': 'Individual',
  'sign_up.business_label': 'Business',
  'sign_up.consent_prefix': "I agree to Crave's",
  'sign_up.consent_terms': 'Terms of Service',
  'sign_up.consent_conjunction': 'and',
  'sign_up.consent_privacy': 'Privacy Policy',
  'sign_up.submit_button': 'Create account',
  'sign_up.footer_text': 'Already have an account?',
  'sign_up.login_link': 'Log in',
  'sign_up.social_unavailable': 'Social sign-up is coming soon. Use email for now.',

  'registration.business_accounts_enabled': 'true',
  'registration.progress_step': '2',
  'registration.progress_total': '4',

  // Home feed section titles & labels
  'home.meet_friends_title': 'Meet Friends',
  // Discover section has three variants depending on location; use {place} as a
  // placeholder for the resolved area name in the "in place" variant.
  'home.discover_title': 'Discover Top Places',
  'home.discover_near_title': 'Discover Places Near You',
  'home.discover_in_place_title': 'Discover Places in {place}',
  'home.latest_posts_title': 'Latest Posts',
  'home.recommended_places_title': 'Recommended Places by Friend',
  'home.meet_people_title': 'Meet People',
  'home.view_all_label': 'View all',
  'home.search_placeholder': 'Search friends, places, posts…',
};

function parseConfig(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [key, raw] of Object.entries(parsed)) {
      result[key] = typeof raw === 'string' ? raw : String(raw ?? '');
    }
    return result;
  } catch {
    return {};
  }
}

export async function getAppConfig(): Promise<{ config: Record<string, string>; updatedAt: Date | null }> {
  const doc = await AppSetting.findOne({ key: APP_CONFIG_KEY });

  if (!doc) {
    // Seed defaults the first time so the panel isn't empty.
    const created = await AppSetting.create({
      key: APP_CONFIG_KEY,
      value: JSON.stringify(DEFAULT_APP_CONFIG),
    });
    return { config: { ...DEFAULT_APP_CONFIG }, updatedAt: created.updatedAt };
  }

  // Merge defaults under the stored config so newly added default keys (e.g.
  // home screen labels shipped in a later release) always surface in the admin
  // panel and to the app, while any admin overrides still take precedence.
  return { config: { ...DEFAULT_APP_CONFIG, ...parseConfig(doc.value) }, updatedAt: doc.updatedAt };
}

export async function setAppConfig(config: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      normalized[trimmedKey] = typeof value === 'string' ? value : String(value ?? '');
    }
  }

  const doc = await AppSetting.findOneAndUpdate(
    { key: APP_CONFIG_KEY },
    { value: JSON.stringify(normalized) },
    { upsert: true, new: true },
  );

  return { config: normalized, updatedAt: doc?.updatedAt ?? new Date() };
}

export async function listUsers(input: { search?: string; page: number; limit: number }) {
  const query: Record<string, unknown> = {};

  if (input.search) {
    const escaped = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { email: new RegExp(escaped, 'i') },
      { givenName: new RegExp(escaped, 'i') },
      { surname: new RegExp(escaped, 'i') },
      { firstName: new RegExp(escaped, 'i') },
      { lastName: new RegExp(escaped, 'i') },
    ];
  }

  const skip = (input.page - 1) * input.limit;

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(input.limit),
    User.countDocuments(query),
  ]);

  return {
    users: users.map((user) => ({
      ...serializeUser(user),
      displayName: getUserDisplayName(user),
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function forceVerifyUser(userId: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;

  if (user.registrationStatus === 'pending_email') {
    user.registrationStatus = 'pending_profile';
  }

  await user.save();

  return {
    user: {
      ...serializeUser(user),
      displayName: getUserDisplayName(user),
    },
    message: 'Email verified successfully',
  };
}

export async function resetUserPassword(userId: string, password: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.refreshTokens = [];
  await user.save();

  await PasswordReset.deleteMany({ email: user.email });

  return {
    userId: user._id.toString(),
    message: 'Password reset successfully. User must sign in again.',
  };
}

export async function deleteUser(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError(400, 'Invalid user id', 'INVALID_USER_ID');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const objectId = user._id;
  const userPostIds = await Post.find({ author: objectId }).distinct('_id');

  await Promise.all([
    PostSave.deleteMany({ $or: [{ user: objectId }, { post: { $in: userPostIds } }] }),
    Post.deleteMany({ author: objectId }),
    Comment.deleteMany({ author: objectId }),
    Notification.deleteMany({ $or: [{ recipient: objectId }, { actor: objectId }] }),
    PlaceComment.deleteMany({ author: objectId }),
    PlaceLike.deleteMany({ user: objectId }),
    PlaceVisit.deleteMany({ user: objectId }),
    PasswordReset.deleteMany({ email: user.email }),
    Post.updateMany({ likes: objectId }, { $pull: { likes: objectId } }),
    Comment.updateMany({ likes: objectId }, { $pull: { likes: objectId } }),
  ]);

  await user.deleteOne();

  return {
    userId,
    message: 'User and related data deleted',
  };
}

type ReportUserRef = {
  _id: Types.ObjectId;
  email: string;
  givenName?: string;
  surname?: string;
  firstName?: string;
  lastName?: string;
  suspended?: boolean;
};

function serializeReportUser(value: unknown): { id: string; name: string; email: string; suspended: boolean } | null {
  if (!value || typeof value !== 'object' || !('_id' in value)) {
    return null;
  }
  const user = value as ReportUserRef;
  return {
    id: user._id.toString(),
    name: getUserDisplayName(user),
    email: user.email,
    suspended: Boolean(user.suspended),
  };
}

export async function listReports(input: { status?: string; page: number; limit: number }) {
  const query: Record<string, unknown> = {};
  if (input.status && input.status !== 'all') {
    query.status = input.status;
  }

  const skip = (input.page - 1) * input.limit;

  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(input.limit)
      .populate('reporter', 'givenName surname firstName lastName email suspended')
      .populate('reportedUser', 'givenName surname firstName lastName email suspended'),
    Report.countDocuments(query),
  ]);

  return {
    reports: reports.map((report) => ({
      id: report._id.toString(),
      reason: report.reason,
      status: report.status,
      conversationId: report.conversation?.toString() ?? null,
      reporter: serializeReportUser(report.reporter),
      reportedUser: serializeReportUser(report.reportedUser),
      createdAt: report.createdAt.toISOString(),
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function setReportStatus(reportId: string, status: 'open' | 'reviewed' | 'dismissed') {
  if (!Types.ObjectId.isValid(reportId)) {
    throw new AppError(400, 'Invalid report id', 'INVALID_REPORT_ID');
  }

  const report = await Report.findById(reportId);
  if (!report) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  report.status = status;
  await report.save();

  return { id: report._id.toString(), status: report.status };
}

export async function suspendUser(userId: string, reason?: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError(400, 'Invalid user id', 'INVALID_USER_ID');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.suspended = true;
  user.suspendedAt = new Date();
  user.suspensionReason = reason?.trim() || 'Your account has been suspended for violating our policies.';
  user.refreshTokens = [];
  await user.save();

  return {
    user: { ...serializeUser(user), displayName: getUserDisplayName(user) },
    message: 'User suspended',
  };
}

export async function unsuspendUser(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError(400, 'Invalid user id', 'INVALID_USER_ID');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.suspended = false;
  user.suspendedAt = undefined;
  user.suspensionReason = undefined;
  await user.save();

  return {
    user: { ...serializeUser(user), displayName: getUserDisplayName(user) },
    message: 'User reinstated',
  };
}

export async function setLiveAudioEnabled(userId: string, enabled: boolean) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError(400, 'Invalid user id', 'INVALID_USER_ID');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.liveAudioEnabled = enabled;
  await user.save();

  return {
    user: { ...serializeUser(user), displayName: getUserDisplayName(user) },
    message: enabled ? 'Live audio enabled for user' : 'Live audio disabled for user',
  };
}

export async function listAppeals(input: { status?: string; page: number; limit: number }) {
  const query: Record<string, unknown> = {};
  if (input.status && input.status !== 'all') {
    query.status = input.status;
  }

  const skip = (input.page - 1) * input.limit;

  const [appeals, total] = await Promise.all([
    Appeal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(input.limit)
      .populate('user', 'givenName surname firstName lastName email suspended'),
    Appeal.countDocuments(query),
  ]);

  return {
    appeals: appeals.map((appeal) => ({
      id: appeal._id.toString(),
      message: appeal.message,
      status: appeal.status,
      user: serializeReportUser(appeal.user),
      createdAt: appeal.createdAt.toISOString(),
      reviewedAt: appeal.reviewedAt?.toISOString() ?? null,
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function reviewAppeal(appealId: string, decision: 'approve' | 'reject') {
  if (!Types.ObjectId.isValid(appealId)) {
    throw new AppError(400, 'Invalid appeal id', 'INVALID_APPEAL_ID');
  }

  const appeal = await Appeal.findById(appealId);
  if (!appeal) {
    throw new AppError(404, 'Appeal not found', 'APPEAL_NOT_FOUND');
  }

  appeal.status = decision === 'approve' ? 'approved' : 'rejected';
  appeal.reviewedAt = new Date();
  await appeal.save();

  // Approving an appeal reinstates the account.
  if (decision === 'approve') {
    const user = await User.findById(appeal.user);
    if (user) {
      user.suspended = false;
      user.suspendedAt = undefined;
      user.suspensionReason = undefined;
      await user.save();
    }
  }

  return { id: appeal._id.toString(), status: appeal.status };
}
