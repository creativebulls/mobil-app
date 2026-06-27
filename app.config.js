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

function fetchAndroidMapsApiKey() {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || 'https://mobilevps.tech').replace(/\/$/, '');
  try {
    const raw = execSync(
      `curl -fsS --max-time 8 "${apiUrl}/api/v1/app-config"`,
      { encoding: 'utf8' },
    );
    const payload = JSON.parse(raw);
    const key = payload?.data?.config?.['maps.google_android_api_key'];
    return typeof key === 'string' && key.trim() ? key.trim() : null;
  } catch {
    return null;
  }
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
    },
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      NSUserActivityTypes: ['INSendMessageIntent'],
    },
  };

  const mapsApiKey =
    fetchAndroidMapsApiKey() ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  if (mapsApiKey) {
    config.android = {
      ...(config.android ?? {}),
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: {
          apiKey: mapsApiKey,
        },
      },
    };
  }

  return config;
};
