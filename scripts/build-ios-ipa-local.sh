#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/build-ios-common.sh
source "$ROOT/scripts/build-ios-common.sh"
# shellcheck source=scripts/build-ios-auth.sh
source "$ROOT/scripts/build-ios-auth.sh"

build_ios_prepare "$ROOT"
build_ios_resolve_xcode "$ROOT"
build_ios_auth_args

EXPORT_METHOD="${IOS_EXPORT_METHOD:-app-store}"
ARCHIVE_PATH="$ROOT/ios/build/${IOS_SCHEME}.xcarchive"
EXPORT_PATH="$ROOT/ios/build/export"
EXPORT_PLIST="$ROOT/ios/build/ExportOptions.plist"

TEAM_XML=""
if [[ -n "${DEVELOPMENT_TEAM:-}" ]]; then
  TEAM_XML="  <key>teamID</key>
  <string>${DEVELOPMENT_TEAM}</string>"
fi

cat > "$EXPORT_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${EXPORT_METHOD}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>uploadSymbols</key>
  <true/>
${TEAM_XML}
</dict>
</plist>
EOF

echo ""
echo "Building release IPA"
echo "  Scheme: $IOS_SCHEME"
echo "  Export method: $EXPORT_METHOD"
echo "  Team: ${DEVELOPMENT_TEAM:-automatic}"

XCODE_SIGN_ARGS=(-allowProvisioningUpdates)
if ((${#AUTH_ARGS[@]})); then
  XCODE_SIGN_ARGS+=("${AUTH_ARGS[@]}")
fi
if [[ -n "${DEVELOPMENT_TEAM:-}" ]]; then
  XCODE_SIGN_ARGS+=(DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM")
fi

cd "$ROOT/ios"
xcodebuild \
  "${IOS_XCODE_TARGET[@]}" \
  -scheme "$IOS_SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive \
  "${XCODE_SIGN_ARGS[@]}" \
  "$@"

xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  "${XCODE_SIGN_ARGS[@]}"

IPA="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' | head -1)"
if [[ -n "$IPA" ]]; then
  echo ""
  echo "✔ IPA built successfully:"
  echo "  $IPA"
  ls -lh "$IPA"
else
  echo "Build finished but IPA not found under $EXPORT_PATH." >&2
  exit 1
fi
