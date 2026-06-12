#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/build-ios-common.sh
source "$ROOT/scripts/build-ios-common.sh"

build_ios_prepare "$ROOT"
build_ios_resolve_xcode "$ROOT"

DERIVED_DATA="$ROOT/ios/build/DerivedData"

echo ""
echo "Building release app for iOS Simulator (no code signing)"
echo "  Scheme: $IOS_SCHEME"

cd "$ROOT/ios"
xcodebuild \
  "${IOS_XCODE_TARGET[@]}" \
  -scheme "$IOS_SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath "$DERIVED_DATA" \
  build \
  "$@"

APP="$(find "$DERIVED_DATA" -name '*.app' -path '*Release-iphonesimulator*' | head -1)"
if [[ -n "$APP" ]]; then
  echo ""
  echo "✔ Simulator app built successfully:"
  echo "  $APP"
  du -sh "$APP"
else
  echo "Build finished but .app not found under $DERIVED_DATA." >&2
  exit 1
fi
