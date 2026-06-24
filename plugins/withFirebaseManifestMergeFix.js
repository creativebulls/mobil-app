/**
 * Resolves manifest merger conflict between expo-notifications and
 * @react-native-firebase/messaging for default_notification_color.
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const META_NAME = 'com.google.firebase.messaging.default_notification_color';

function withFirebaseManifestMergeFix(config) {
  return withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const meta = app['meta-data']?.find((entry) => entry.$?.['android:name'] === META_NAME);

    if (meta?.$) {
      meta.$['tools:replace'] = 'android:resource';
    }

    return config;
  });
}

module.exports = withFirebaseManifestMergeFix;
