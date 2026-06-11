import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { MyFeedScreen } from '../src/components/MyFeedScreen';
import { MainScreenLayout } from '../src/components/MainScreenLayout';
import { useLocationPrompt } from '../src/hooks/useLocationPrompt';

export default function HomeScreen() {
  const router = useRouter();

  useLocationPrompt();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <MainScreenLayout activeTab="home">
      <StatusBar style="dark" />
      <MyFeedScreen />
    </MainScreenLayout>
  );
}
