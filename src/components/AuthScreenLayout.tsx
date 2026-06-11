import { Href } from 'expo-router';
import { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenBackRow } from './ScreenBackRow';
import { authStyles } from '../theme/authStyles';

type AuthScreenLayoutProps = {
  children: ReactNode;
  fallbackHref?: Href;
  headerIcon?: ReactNode;
};

export function AuthScreenLayout({
  children,
  fallbackHref = '/sign-in',
  headerIcon,
}: AuthScreenLayoutProps) {
  return (
    <View style={authStyles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={authStyles.container}>
        <View style={authStyles.topSection}>
          <ScreenBackRow fallbackHref={fallbackHref} variant="light" />
          <View style={authStyles.logoWrap} pointerEvents="none">
            {headerIcon ?? (
              <Image
                source={require('../../assets/black-logo.png')}
                style={authStyles.logo}
                resizeMode="contain"
                accessibilityLabel="WhereAbout logo"
              />
            )}
          </View>
        </View>
        {children}
      </SafeAreaView>
    </View>
  );
}
