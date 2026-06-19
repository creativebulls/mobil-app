import { useCallback, useEffect, useRef, useState } from 'react';

import { readCache, writeCache, type CachedValue } from '../storage/offlineCache';

type UseCachedResourceState<T> = {
  /** Cached-then-fresh data. Null until either the cache or the first fetch resolves. */
  data: T | null;
  /** True only on the very first load when there is no cached data to show yet. */
  isLoading: boolean;
  /** True while a background refresh is running (cached data is already shown). */
  isRefreshing: boolean;
  /** True when the data on screen came from cache because the last fetch failed. */
  isStale: boolean;
  /** Epoch ms of the data currently shown, if known. */
  updatedAt: number | null;
  error: unknown;
  refresh: () => Promise<void>;
  /** Local update (e.g. optimistic) that also persists to the cache. */
  mutate: (next: T) => void;
};

/**
 * Cache-then-network data hook. On mount it shows the cached value immediately
 * (if any), then fetches fresh data and updates the cache. If the fetch fails
 * (e.g. offline), the cached value stays on screen and `isStale` becomes true.
 */
export function useCachedResource<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean } = {},
): UseCachedResourceState<T> {
  const { enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  // Keep the latest fetcher without making it a dependency (fetchers are often
  // inline closures that change identity every render).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const hasDataRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setIsRefreshing(true);
    try {
      const fresh = await fetcherRef.current();
      hasDataRef.current = true;
      setData(fresh);
      setUpdatedAt(Date.now());
      setIsStale(false);
      setError(null);
      void writeCache(cacheKey, fresh);
    } catch (err) {
      setError(err);
      // Only mark stale if we actually have something cached to show.
      if (hasDataRef.current) {
        setIsStale(true);
      }
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [cacheKey, enabled]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    hasDataRef.current = false;

    // 1) Hydrate from cache for an instant first paint.
    void readCache<T>(cacheKey).then((cached: CachedValue<T> | null) => {
      if (cancelled || !cached) {
        return;
      }
      hasDataRef.current = true;
      setData(cached.data);
      setUpdatedAt(cached.updatedAt);
      setIsLoading(false);
    });

    // 2) Fetch fresh data in the background.
    void refresh();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, refresh]);

  const mutate = useCallback(
    (next: T) => {
      hasDataRef.current = true;
      setData(next);
      void writeCache(cacheKey, next);
    },
    [cacheKey],
  );

  return { data, isLoading, isRefreshing, isStale, updatedAt, error, refresh, mutate };
}
