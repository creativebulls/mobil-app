/**
 * Copies the custom notification sound into the Android project on prebuild.
 * iOS uses the expo-notifications plugin `sounds` entry in app.json.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join('assets', 'notification_recived_sount.mp3');
const ANDROID_NAME = 'notification_recived_sount.mp3';

function copySound(projectRoot, destination) {
  const sourcePath = path.join(projectRoot, SOURCE);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`[withNotificationSound] Missing sound asset at ${SOURCE}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(sourcePath, destination);
}

function withNotificationSound(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const rawDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      copySound(projectRoot, path.join(rawDir, ANDROID_NAME));
      return config;
    },
  ]);
}

module.exports = withNotificationSound;
