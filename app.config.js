// Dynamic Expo config.
//
// The canonical configuration lives in app.json; this file only adjusts it
// programmatically. Critical behaviour: `expo-dev-client` (the Expo Dev
// Launcher/Menu) must never be compiled into a production / App Store build.
// Shipping the dev launcher to TestFlight/App Store is unsupported by Expo and
// routes app startup through the dev-launcher controller, which is a known
// cause of launch crashes / black screens on physical devices. The dev client
// is only needed for `development` (and optionally `preview`) builds.
//
// `EAS_BUILD_PROFILE` is set automatically by EAS; `APP_VARIANT` is set by our
// local production build scripts and the EAS production env.
const { execSync } = require('child_process');

const IS_PRODUCTION =
  process.env.APP_VARIANT === 'production' ||
  process.env.EAS_BUILD_PROFILE === 'production';

function fetchRemoteAppConfig() {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || 'https://mobilevps.tech').replace(/\/$/, '');
  try {
    const raw = execSync(
      `curl -fsS --max-time 8 "${apiUrl}/api/v1/app-config"`,
      { encoding: 'utf8' },
    );
    const payload = JSON.parse(raw);
    return payload?.data?.config ?? {};
  } catch {
    return {};
  }
}

function fetchMapsApiKeys() {
  const config = fetchRemoteAppConfig();
  const android = config['maps.google_android_api_key'];
  const ios = config['maps.google_ios_api_key'];
  return {
    android: typeof android === 'string' && android.trim() ? android.trim() : null,
    ios: typeof ios === 'string' && ios.trim() ? ios.trim() : null,
  };
}

function googleIosUrlScheme(iosClientId) {
  if (typeof iosClientId !== 'string' || !iosClientId.endsWith('.apps.googleusercontent.com')) {
    return null;
  }
  const prefix = iosClientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${prefix}`;
}

module.exports = ({ config }) => {
  if (IS_PRODUCTION && Array.isArray(config.plugins)) {
    config.plugins = config.plugins.filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return name !== 'expo-dev-client';
    });
  }

  // Telegram-style push (sender avatar + app badge) uses iOS Communication
  // Notifications via Notifee + a Notification Service Extension.
  config.plugins = [
    ...(config.plugins ?? []),
    'expo-apple-authentication',
    './plugins/withNotificationSound.js',
    [
      '@evennit/notifee-expo-plugin',
      {
        iosDeploymentTarget: '15.1',
        apsEnvMode: IS_PRODUCTION ? 'production' : 'development',
        enableCommunicationNotifications: true,
        appleDevTeamId: '45P2ZV9AZW',
        backgroundModes: ['remote-notification'],
        customNotificationServiceFilePath: './plugins/ios/NotificationService.m',
      },
    ],
    './plugins/withFirebaseManifestMergeFix.js',
  ];

  config.ios = {
    ...(config.ios ?? {}),
    entitlements: {
      ...(config.ios?.entitlements ?? {}),
      'com.apple.developer.usernotifications.communication': true,
      'com.apple.developer.applesignin': ['Default'],
    },
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      NSUserActivityTypes: ['INSendMessageIntent'],
    },
  };

  const remoteKeys = fetchMapsApiKeys();
  const remoteConfig = fetchRemoteAppConfig();
  const googleIosClientId = remoteConfig['auth.google.ios_client_id'];
  const googleIosUrlSchemeValue = googleIosUrlScheme(googleIosClientId);

  if (googleIosUrlSchemeValue) {
    config.plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: googleIosUrlSchemeValue },
    ]);
  } else {
    config.plugins.push('@react-native-google-signin/google-signin');
  }

  const androidMapsApiKey =
    remoteKeys.android ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? null;
  const iosMapsApiKey =
    remoteKeys.ios ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? null;

  if (androidMapsApiKey) {
    config.android = {
      ...(config.android ?? {}),
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: {
          apiKey: androidMapsApiKey,
        },
      },
    };
  }

  if (iosMapsApiKey) {
    config.ios = {
      ...(config.ios ?? {}),
      config: {
        ...(config.ios?.config ?? {}),
        googleMapsApiKey: iosMapsApiKey,
      },
    };
  }

  return config;
};
