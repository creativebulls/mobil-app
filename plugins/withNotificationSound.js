/**
 * Copies the custom notification sound into native projects on prebuild.
 * - Android: res/raw/notification_recived_sount.mp3
 * - iOS: {AppName}/notification-recived-sount.mp3 (bundle resource for APNs)
 */
const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join('assets', 'notification-recived-sount.mp3');
const ANDROID_NAME = 'notification_recived_sount.mp3';
const IOS_NAME = 'notification-recived-sount.mp3';

function copySound(projectRoot, destination) {
  const sourcePath = path.join(projectRoot, SOURCE);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`[withNotificationSound] Missing sound asset at ${SOURCE}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(sourcePath, destination);
}

function withNotificationSound(config) {
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const rawDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      copySound(projectRoot, path.join(rawDir, ANDROID_NAME));
      return config;
    },
  ]);

  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const projectName = IOSConfig.XcodeUtils.getProjectName(platformProjectRoot);
      copySound(
        projectRoot,
        path.join(platformProjectRoot, projectName, IOS_NAME),
      );
      return config;
    },
  ]);

  return config;
}

module.exports = withNotificationSound;
