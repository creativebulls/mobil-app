#!/usr/bin/env bash
# Shared auth helpers for local iOS archive + TestFlight upload (no EAS).

build_ios_auth_args() {
  AUTH_ARGS=()
  if [[ -n "${APP_STORE_CONNECT_API_KEY_ID:-}" && -n "${APP_STORE_CONNECT_API_ISSUER_ID:-}" && -n "${APP_STORE_CONNECT_API_KEY_PATH:-}" ]]; then
    if [[ ! -f "$APP_STORE_CONNECT_API_KEY_PATH" ]]; then
      echo "APP_STORE_CONNECT_API_KEY_PATH not found: $APP_STORE_CONNECT_API_KEY_PATH" >&2
      exit 1
    fi
    AUTH_ARGS+=(
      -authenticationKeyPath "$APP_STORE_CONNECT_API_KEY_PATH"
      -authenticationKeyID "$APP_STORE_CONNECT_API_KEY_ID"
      -authenticationKeyIssuerID "$APP_STORE_CONNECT_API_ISSUER_ID"
    )
  elif [[ ! -f "$HOME/Library/Developer/Xcode/UserData/IDEAccounts.plist" ]]; then
    echo "Note: proceeding without API key — using Xcode automatic signing (requires Apple ID in Xcode)." >&2
  fi
}

build_ios_upload_args() {
  UPLOAD_ARGS=()
  if [[ -n "${APP_STORE_CONNECT_API_KEY_ID:-}" && -n "${APP_STORE_CONNECT_API_ISSUER_ID:-}" && -n "${APP_STORE_CONNECT_API_KEY_PATH:-}" ]]; then
    UPLOAD_ARGS+=(--apiKey "$APP_STORE_CONNECT_API_KEY_ID" --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID")
    export APP_STORE_CONNECT_PRIVATE_KEY_PATH="$APP_STORE_CONNECT_API_KEY_PATH"
  elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
    UPLOAD_ARGS+=(-u "$APPLE_ID" -p "$APPLE_APP_SPECIFIC_PASSWORD")
  else
    echo "Set App Store Connect API key or APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD for upload." >&2
    exit 1
  fi
}
