#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://mobilevps.tech}"
export APP_VARIANT=production

echo "Building release AAB"
echo "  API: $EXPO_PUBLIC_API_URL"
echo "  JAVA_HOME: $JAVA_HOME"

WEBRTC_GRADLE="$ROOT/node_modules/react-native-webrtc/android/build.gradle"
if [[ -f "$WEBRTC_GRADLE" ]]; then
  sed -i '' "s/org.jitsi:webrtc:124.+/org.jitsi:webrtc:124.0.0/g" "$WEBRTC_GRADLE"
fi

cd "$ROOT/android"
./gradlew bundleRelease -x lintVitalAnalyzeRelease "$@"

AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
if [[ -f "$AAB" ]]; then
  echo ""
  echo "✔ AAB built successfully:"
  echo "  $AAB"
  ls -lh "$AAB"
else
  echo "Build finished but AAB not found at expected path." >&2
  exit 1
fi
