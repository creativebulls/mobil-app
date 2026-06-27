import { FriendsMapScreen } from '../src/components/FriendsMapScreen';
import { MainScreenLayout } from '../src/components/MainScreenLayout';
import { useLocationPrompt } from '../src/hooks/useLocationPrompt';

export default function MapScreen() {
  useLocationPrompt();

  return (
    <MainScreenLayout activeTab="map">
      <FriendsMapScreen />
    </MainScreenLayout>
  );
}
