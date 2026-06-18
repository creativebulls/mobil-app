import { NativeModules, Platform } from 'react-native';

/**
 * Android foreground service that keeps a consented live audio session running
 * while the app is backgrounded or minimized. The persistent notification it
 * shows is required by the OS and doubles as a clear, always-visible indicator
 * that the microphone is active. Backed by the native LiveAudioService module.
 */

type LiveAudioNativeModule = {
  start: () => Promise<boolean>;
  stop: () => Promise<boolean>;
};

const native = (NativeModules as { LiveAudioService?: LiveAudioNativeModule }).LiveAudioService;

let serviceRunning = false;

// Kept for API compatibility with callers; native registration is automatic.
export function registerLiveForegroundService(): void {
  /* no-op: the native foreground service requires no JS-side registration */
}

export async function startLiveForegroundService(): Promise<void> {
  if (Platform.OS !== 'android' || serviceRunning || !native) {
    return;
  }
  try {
    await native.start();
    serviceRunning = true;
  } catch {
    serviceRunning = false;
  }
}

export async function stopLiveForegroundService(): Promise<void> {
  if (Platform.OS !== 'android' || !serviceRunning || !native) {
    return;
  }
  serviceRunning = false;
  try {
    await native.stop();
  } catch {
    // ignore
  }
}
