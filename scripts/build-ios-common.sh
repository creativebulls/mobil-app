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
  export EAS_BUILD_PROFILE=production

  echo "Preparing iOS project"
  echo "  API: $EXPO_PUBLIC_API_URL"
  echo "  Variant: production (no dev client)"

  cd "$root"
  if [[ "${PREBUILD_CLEAN:-1}" == "1" ]]; then
    npx expo prebuild --platform ios --clean
  elif [[ ! -f "$root/ios/Crave.xcworkspace/contents.xcworkspacedata" ]]; then
    npx expo prebuild --platform ios
  else
    echo "Skipping prebuild (using existing ios/ project)"
  fi

  if [[ -f "$root/ios/Podfile" ]]; then
    echo "Installing CocoaPods..."
    build_ios_fix_release_signing "$root"
    (cd "$root/ios" && pod install)
  fi
}

build_ios_fix_release_signing() {
  local root="$1"
  local pbx="$root/ios/Crave.xcodeproj/project.pbxproj"

  if [[ "${IOS_EXPORT_METHOD:-app-store}" != "app-store" ]]; then
    return 0
  fi

  if [[ -f "$pbx" ]]; then
    sed -i '' '/"CODE_SIGN_IDENTITY\[sdk=iphoneos\*\]" = "iPhone Developer";/d' "$pbx"
    sed -i '' '/"CODE_SIGN_IDENTITY\[sdk=iphoneos\*\]" = "Apple Distribution";/d' "$pbx"
    sed -i '' '/CODE_SIGN_IDENTITY = "Apple Distribution";/d' "$pbx"
    if ! grep -A25 "13B07F951A680F5B00A75B9A /\* Release \*/" "$pbx" | grep -q CODE_SIGN_STYLE; then
      sed -i '' '/13B07F951A680F5B00A75B9A \/\* Release \*\//,/name = Release;/ s/CODE_SIGN_ENTITLEMENTS = Crave\/Crave.entitlements;/CODE_SIGN_ENTITLEMENTS = Crave\/Crave.entitlements;\
				CODE_SIGN_STYLE = Automatic;/' "$pbx"
    fi
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
