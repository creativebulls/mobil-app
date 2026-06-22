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
const IS_PRODUCTION =
  process.env.APP_VARIANT === 'production' ||
  process.env.EAS_BUILD_PROFILE === 'production';

module.exports = ({ config }) => {
  if (IS_PRODUCTION && Array.isArray(config.plugins)) {
    config.plugins = config.plugins.filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return name !== 'expo-dev-client';
    });
  }

  return config;
};
