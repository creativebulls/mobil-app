#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://mobilevps.tech}"
export APP_VARIANT=production

echo "Building release APK"
echo "  API: $EXPO_PUBLIC_API_URL"
echo "  JAVA_HOME: $JAVA_HOME"

cd "$ROOT/android"
./gradlew assembleRelease -x lintVitalAnalyzeRelease "$@"

APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
if [[ -f "$APK" ]]; then
  echo ""
  echo "✔ APK built successfully:"
  echo "  $APK"
  ls -lh "$APK"
else
  echo "Build finished but APK not found at expected path." >&2
  exit 1
fi
