const { getDefaultConfig } = require('expo/metro-config');
const resolveFrom = require('resolve-from');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native depends on event-target-shim@5 while react-native-webrtc needs
// event-target-shim@6. Metro's default resolver picks the wrong one, which
// breaks WebRTC at runtime. Resolve event-target-shim from within
// react-native-webrtc so it gets its own (v6) copy.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith('event-target-shim') &&
    context.originModulePath.includes('react-native-webrtc')
  ) {
    const updatedModuleName = moduleName.endsWith('/index')
      ? moduleName.replace('/index', '')
      : moduleName;

    return {
      filePath: resolveFrom(context.originModulePath, updatedModuleName),
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
