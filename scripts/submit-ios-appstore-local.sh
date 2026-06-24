#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/build-ios-auth.sh
source "$ROOT/scripts/build-ios-auth.sh"

IPA="${1:-$(find "$ROOT/ios/build/export" -maxdepth 1 -name '*.ipa' 2>/dev/null | head -1)}"

if [[ -z "$IPA" || ! -f "$IPA" ]]; then
  echo "Usage: $0 [path/to/app.ipa]" >&2
  exit 1
fi

build_ios_upload_args

echo "Uploading to TestFlight (App Store Connect)"
echo "  IPA: $IPA"

xcrun altool --upload-app -f "$IPA" -t ios "${UPLOAD_ARGS[@]}"

echo ""
echo "✔ Upload submitted. Processing usually takes 5–15 minutes."
echo "  TestFlight: https://appstoreconnect.apple.com/apps/6782056309/testflight/ios"
