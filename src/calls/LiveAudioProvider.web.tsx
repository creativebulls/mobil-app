import type { ReactNode } from 'react';

/**
 * Web stub for the live-audio system. `react-native-webrtc` has no browser
 * build, so on web this provider just renders its children with no live-audio
 * capability.
 */
export function LiveAudioProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
