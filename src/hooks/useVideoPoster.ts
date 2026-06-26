import { useEffect, useState } from 'react';

import { useMediaUrl } from './useMediaUrl';
import { createVideoThumbnail } from '../utils/videoThumbnail';

export function useVideoPoster(
  uri: string,
  posterUri: string | null | undefined,
  resolvedVideo: string | null,
) {
  const resolvedPoster = useMediaUrl(posterUri);
  const [fallbackPoster, setFallbackPoster] = useState<string | null>(null);
  const [loadingPoster, setLoadingPoster] = useState(!resolvedPoster);

  useEffect(() => {
    if (resolvedPoster) {
      setLoadingPoster(false);
      return;
    }

    let cancelled = false;
    setLoadingPoster(true);

    const source = resolvedVideo ?? uri;
    void createVideoThumbnail(source).then((thumb) => {
      if (!cancelled) {
        setFallbackPoster(thumb);
        setLoadingPoster(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uri, resolvedVideo, resolvedPoster]);

  return {
    displayPoster: resolvedPoster ?? fallbackPoster,
    loadingPoster,
  };
}
