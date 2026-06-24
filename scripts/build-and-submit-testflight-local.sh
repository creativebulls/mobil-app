#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://mobilevps.tech}"
export APP_VARIANT=production
export EAS_BUILD_PROFILE=production
export DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-45P2ZV9AZW}"
export IOS_EXPORT_METHOD=app-store

echo "=== Crave iOS TestFlight (local, no EAS) ==="
echo "  API: $EXPO_PUBLIC_API_URL"
echo "  Team: $DEVELOPMENT_TEAM"
echo "  Build number: $(node -p "require('./app.json').expo.ios.buildNumber")"
echo ""

bash "$ROOT/scripts/build-ios-ipa-local.sh"
bash "$ROOT/scripts/submit-ios-appstore-local.sh"
