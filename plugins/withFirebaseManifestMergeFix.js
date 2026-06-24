/**
 * Resolves manifest merger conflict between expo-notifications and
 * @react-native-firebase/messaging for default_notification_color.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const META_NAME = 'com.google.firebase.messaging.default_notification_color';

function withFirebaseManifestMergeFix(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'AndroidManifest.xml',
      );

      if (!fs.existsSync(manifestPath)) {
        return config;
      }

      let xml = fs.readFileSync(manifestPath, 'utf8');
      const metaPattern = new RegExp(
        `<meta-data android:name="${META_NAME}" android:resource="@color/notification_icon_color"(?!\\s+tools:replace)[^/]*/>`,
      );

      if (metaPattern.test(xml)) {
        xml = xml.replace(
          metaPattern,
          `<meta-data android:name="${META_NAME}" android:resource="@color/notification_icon_color" tools:replace="android:resource"/>`,
        );
        fs.writeFileSync(manifestPath, xml);
      }

      return config;
    },
  ]);
}

module.exports = withFirebaseManifestMergeFix;
