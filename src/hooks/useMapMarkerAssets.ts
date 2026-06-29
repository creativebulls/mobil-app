import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';

import { resolveMediaUrl } from '../utils/mediaUrl';

type MapMarkerAssets = {
  resolvedAvatar: string | null;
  resolvedPhotos: Record<string, string | null>;
  resolvedFriendAvatars: Record<string, string | null>;
  isReady: boolean;
};

/**
 * Resolves and prefetches all map marker images before markers are shown.
 * Android MapView snapshots custom markers once — images must be cached first.
 */
export function useMapMarkerAssets(
  avatarUri: string | null | undefined,
  photoById: Record<string, string | null>,
  placeIds: string[],
  friendAvatarById: Record<string, string | null> = {},
): MapMarkerAssets {
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(null);
  const [resolvedPhotos, setResolvedPhotos] = useState<Record<string, string | null>>({});
  const [resolvedFriendAvatars, setResolvedFriendAvatars] = useState<Record<string, string | null>>({});
  const [isReady, setIsReady] = useState(false);

  const friendIds = useMemo(() => Object.keys(friendAvatarById).sort(), [friendAvatarById]);

  const assetKey = useMemo(() => {
    const parts = [avatarUri ?? ''];
    for (const id of placeIds) {
      parts.push(`p:${id}:${photoById[id] ?? ''}`);
    }
    for (const id of friendIds) {
      parts.push(`f:${id}:${friendAvatarById[id] ?? ''}`);
    }
    return parts.join('|');
  }, [avatarUri, friendAvatarById, friendIds, photoById, placeIds]);

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);

    void (async () => {
      const photoEntries = await Promise.all(
        placeIds.map(async (id) => {
          const url = photoById[id];
          if (!url) {
            return [id, null] as const;
          }
          return [id, await resolveMediaUrl(url)] as const;
        }),
      );

      const friendEntries = await Promise.all(
        friendIds.map(async (id) => {
          const url = friendAvatarById[id];
          if (!url) {
            return [id, null] as const;
          }
          return [id, await resolveMediaUrl(url)] as const;
        }),
      );

      const avatar = avatarUri ? await resolveMediaUrl(avatarUri) : null;
      if (cancelled) {
        return;
      }

      const nextPhotos: Record<string, string | null> = {};
      for (const [id, url] of photoEntries) {
        nextPhotos[id] = url;
      }

      const nextFriendAvatars: Record<string, string | null> = {};
      for (const [id, url] of friendEntries) {
        nextFriendAvatars[id] = url;
      }

      setResolvedAvatar(avatar);
      setResolvedPhotos(nextPhotos);
      setResolvedFriendAvatars(nextFriendAvatars);

      const prefetchUrls = [
        avatar,
        ...photoEntries.map(([, url]) => url).filter((url): url is string => Boolean(url)),
        ...friendEntries.map(([, url]) => url).filter((url): url is string => Boolean(url)),
      ];

      if (prefetchUrls.length > 0) {
        await Promise.all(prefetchUrls.map((url) => Image.prefetch(url).catch(() => false)));
      }

      if (cancelled) {
        return;
      }

      setTimeout(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      }, 150);
    })();

    return () => {
      cancelled = true;
    };
  }, [assetKey, avatarUri, friendAvatarById, friendIds, photoById, placeIds]);

  return { resolvedAvatar, resolvedPhotos, resolvedFriendAvatars, isReady };
}
