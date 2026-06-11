import { useEffect, useState } from 'react';

import { resolveMediaUrl } from '../utils/mediaUrl';

export function useMediaUrl(uri: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!uri) {
      setResolved(null);
      return;
    }

    void resolveMediaUrl(uri).then((url) => {
      if (!cancelled) {
        setResolved(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return resolved;
}
