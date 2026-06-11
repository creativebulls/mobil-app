import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const API_PORT = 4000;
const HEALTH_PATH = '/health';
const PROBE_TIMEOUT_MS = 2500;

/**
 * LAN IP the device used to reach the Metro bundler (physical devices / tunnels).
 */
function getMetroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost ??
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (!hostUri) {
    return null;
  }

  const host = hostUri.split(':')[0]?.trim();
  return host || null;
}

/**
 * Ordered list of candidate backend hosts to probe. The order is tuned per
 * platform so the most likely host is tried first, but every option is kept as
 * a fallback so the app can auto-detect whichever one actually works.
 */
function candidateHosts(): string[] {
  const hosts: string[] = [];

  const push = (url: string) => {
    const clean = url.replace(/\/$/, '');
    if (!hosts.includes(clean)) {
      hosts.push(clean);
    }
  };

  if (process.env.EXPO_PUBLIC_API_URL) {
    push(process.env.EXPO_PUBLIC_API_URL);
  }

  const localhost = `http://localhost:${API_PORT}`;
  const emulatorAlias = `http://10.0.2.2:${API_PORT}`;
  const metroHost = getMetroHost();
  const lanHost =
    metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1'
      ? `http://${metroHost}:${API_PORT}`
      : null;

  if (Platform.OS === 'android' && Device.isDevice) {
    // Physical Android device: LAN IP first, then adb-reverse localhost.
    if (lanHost) push(lanHost);
    push(localhost);
    push(emulatorAlias);
  } else if (Platform.OS === 'android') {
    // Android emulator: localhost (with adb reverse) then the 10.0.2.2 alias.
    push(localhost);
    push(emulatorAlias);
    if (lanHost) push(lanHost);
  } else if (Platform.OS === 'ios' && Device.isDevice) {
    // Physical iOS device: only the LAN IP is reachable.
    if (lanHost) push(lanHost);
    push(localhost);
  } else {
    // iOS simulator / web: localhost works directly.
    push(localhost);
    if (lanHost) push(lanHost);
  }

  push(`http://127.0.0.1:${API_PORT}`);

  return hosts;
}

async function probe(base: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const response = await fetch(`${base}${HEALTH_PATH}`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

let resolvedHost: string | null = null;
let inflight: Promise<string> | null = null;

/**
 * Resolves (and caches) the first reachable backend host by probing each
 * candidate's /health endpoint. Falls back to the top candidate if none reply,
 * so requests still have a sensible target (and a clear error).
 */
export async function resolveBackendHost(): Promise<string> {
  if (resolvedHost) {
    return resolvedHost;
  }

  if (!inflight) {
    inflight = (async () => {
      const candidates = candidateHosts();

      for (const host of candidates) {
        // eslint-disable-next-line no-await-in-loop
        if (await probe(host)) {
          resolvedHost = host;
          break;
        }
      }

      if (!resolvedHost) {
        resolvedHost = candidates[0] ?? `http://localhost:${API_PORT}`;
      }

      inflight = null;
      return resolvedHost;
    })();
  }

  return inflight;
}

/** Clears the cached host so the next call re-probes (used to self-heal). */
export function resetBackendHost(): void {
  resolvedHost = null;
  inflight = null;
}

export async function getApiBaseUrl(): Promise<string> {
  return `${await resolveBackendHost()}/api/v1`;
}

export async function getSocketUrl(): Promise<string> {
  return resolveBackendHost();
}
