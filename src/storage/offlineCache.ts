import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lightweight offline cache on top of AsyncStorage. Successful API responses are
 * persisted so screens can render the last-known data instantly on launch and
 * keep showing it when the device is offline (the fetch simply fails and we fall
 * back to the cached copy).
 *
 * Cached data is namespaced under a single prefix and wiped on logout so one
 * account never sees another account's data.
 */

const PREFIX = '@whereabout/cache/';

// Bump when the shape of cached payloads changes in an incompatible way; older
// entries are then ignored instead of being handed to new code.
const VERSION = 1;

type CacheEntry<T> = {
  version: number;
  updatedAt: number;
  data: T;
};

export type CachedValue<T> = {
  data: T;
  /** Epoch ms when this value was last written from a successful fetch. */
  updatedAt: number;
};

/** Reads a cached value (with its timestamp), or null if missing/corrupt/stale-version. */
export async function readCache<T>(key: string): Promise<CachedValue<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) {
      return null;
    }
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.version !== VERSION || entry.data === undefined) {
      return null;
    }
    return { data: entry.data, updatedAt: entry.updatedAt };
  } catch {
    return null;
  }
}

/** Persists a value for later offline reads. Failures (e.g. quota) are swallowed. */
export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { version: VERSION, updatedAt: Date.now(), data };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Caching is best-effort; never let a cache write break a screen.
  }
}

/** Removes every cached entry. Call on logout to avoid cross-account leakage. */
export async function clearOfflineCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(PREFIX));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch {
    // ignore
  }
}
