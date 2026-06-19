import { useEffect, useState } from 'react';

import { getIsOnline, subscribeNetworkStatus } from '../api/networkStatus';

/**
 * Reactive connectivity flag. Driven by the outcome of API requests (see
 * `src/api/networkStatus.ts`), so it flips to `false` as soon as a request
 * fails at the network level and back to `true` once a request succeeds.
 */
export function useIsOnline(): boolean {
  const [online, setOnlineState] = useState<boolean>(getIsOnline());

  useEffect(() => subscribeNetworkStatus(setOnlineState), []);

  return online;
}
