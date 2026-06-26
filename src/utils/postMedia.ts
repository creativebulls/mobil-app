const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)(\?|$)/i;

export function isVideoMediaUrl(url?: string | null): boolean {
  return !!url && VIDEO_EXTENSIONS.test(url);
}

export function getPostMediaUris(post: {
  imageUri: string | null;
  imageUris: string[];
}): string[] {
  if (post.imageUris && post.imageUris.length > 0) {
    return post.imageUris;
  }
  if (post.imageUri) {
    return [post.imageUri];
  }
  return [];
}

export function getPostTileThumbnail(post: {
  imageUri: string | null;
  imageUris: string[];
  videoPosterUris?: (string | null)[];
}): {
  imageUri: string | null;
  videoUri: string | null;
  posterUri: string | null;
  isVideo: boolean;
  mediaCount: number;
} {
  const mediaUris = getPostMediaUris(post);
  const first = mediaUris[0];

  if (!first) {
    return { imageUri: null, videoUri: null, posterUri: null, isVideo: false, mediaCount: 0 };
  }

  if (isVideoMediaUrl(first)) {
    return {
      imageUri: null,
      videoUri: first,
      posterUri: getVideoPosterForUri(mediaUris, post.videoPosterUris, first),
      isVideo: true,
      mediaCount: mediaUris.length,
    };
  }

  return {
    imageUri: first,
    videoUri: null,
    posterUri: null,
    isVideo: false,
    mediaCount: mediaUris.length,
  };
}

export function getVideoPosterForUri(
  imageUris: string[],
  videoPosterUris: (string | null)[] | undefined,
  videoUri: string,
): string | null {
  const index = imageUris.indexOf(videoUri);
  if (index < 0) {
    return null;
  }
  return videoPosterUris?.[index] ?? null;
}

export type ProfilePostTab = 'images' | 'videos' | 'text';

export function getProfilePostTab(post: {
  imageUri: string | null;
  imageUris: string[];
}): ProfilePostTab {
  const mediaUris = getPostMediaUris(post);
  if (mediaUris.length === 0) {
    return 'text';
  }
  if (mediaUris.some((uri) => isVideoMediaUrl(uri))) {
    return 'videos';
  }
  return 'images';
}

export function filterPostsByProfileTab<T extends { imageUri: string | null; imageUris: string[] }>(
  posts: T[],
  tab: ProfilePostTab,
): T[] {
  return posts.filter((post) => getProfilePostTab(post) === tab);
}
