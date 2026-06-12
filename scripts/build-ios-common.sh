#!/usr/bin/env bash
# Shared setup for local iOS production builds.

build_ios_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

build_ios_prepare() {
  local root="$1"

  export LANG="${LANG:-en_US.UTF-8}"
  export LC_ALL="${LC_ALL:-en_US.UTF-8}"
  export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://mobilevps.tech}"
  export APP_VARIANT=production

  echo "Preparing iOS project"
  echo "  API: $EXPO_PUBLIC_API_URL"
  echo "  Variant: production (no dev client)"

  cd "$root"
  if [[ "${PREBUILD_CLEAN:-1}" == "1" ]]; then
    npx expo prebuild --platform ios --clean
  else
    npx expo prebuild --platform ios
  fi

  if [[ -f "$root/ios/Podfile" ]] && [[ ! -d "$root/ios/Pods" ]]; then
    echo "Installing CocoaPods..."
    (cd "$root/ios" && pod install)
  fi
}

build_ios_resolve_xcode() {
  local root="$1"

  IOS_WORKSPACE="$(find "$root/ios" -maxdepth 1 -name '*.xcworkspace' 2>/dev/null | head -1)"
  IOS_PROJECT="$(find "$root/ios" -maxdepth 1 -name '*.xcodeproj' 2>/dev/null | head -1)"

  if [[ -n "$IOS_WORKSPACE" ]]; then
    IOS_XCODE_TARGET=(-workspace "$IOS_WORKSPACE")
    IOS_SCHEME="$(basename "$IOS_WORKSPACE" .xcworkspace)"
  elif [[ -n "$IOS_PROJECT" ]]; then
    IOS_XCODE_TARGET=(-project "$IOS_PROJECT")
    IOS_SCHEME="$(basename "$IOS_PROJECT" .xcodeproj)"
  else
    echo "No Xcode project found under ios/. Run prebuild first." >&2
    exit 1
  fi

  mkdir -p "$root/ios/build"
}
