// Custom entry point.
//
// The brand/theme colour is admin-managed (config key `theme.brand_color`).
// Because the colour is consumed by many module-level `StyleSheet.create` calls
// (evaluated at import time), we must apply the cached value BEFORE the Expo
// Router app — and therefore all route/component modules — is required.
//
// Flow: read the cached app config synchronously-ish (AsyncStorage), apply the
// brand colour into the shared `colors`/`gradients` objects, then require the
// router. The colour an admin sets takes effect on the next app launch.

import '@expo/metro-runtime';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';

import { applyBrandColor } from './src/theme/colors';

// Keep the native splash up until we've applied the colour and mounted the app.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Must match CACHE_KEY in src/config/ConfigProvider.tsx.
const CONFIG_CACHE_KEY = '@whereabout/app_config';
const BRAND_COLOR_KEY = 'theme.brand_color';

async function loadCachedBrandColor() {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) {
      return;
    }
    const config = JSON.parse(raw);
    applyBrandColor(config?.[BRAND_COLOR_KEY]);
  } catch {
    // Ignore corrupt cache / storage errors and fall back to the default brand.
  }
}

function Root() {
  const [AppComponent, setAppComponent] = useState(null);

  useEffect(() => {
    let active = true;
    void loadCachedBrandColor().finally(() => {
      // Require the router only after the brand colour has been applied so route
      // StyleSheets evaluate with the themed palette.
      const { App } = require('expo-router/build/qualified-entry');
      if (active) {
        setAppComponent(() => App);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!AppComponent) {
    // Native splash stays visible while we resolve the colour.
    return null;
  }

  return React.createElement(AppComponent);
}

registerRootComponent(Root);
