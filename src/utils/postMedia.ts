const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)(\?|$)/i;

export function isVideoMediaUrl(url?: string | null): boolean {
  return !!url && VIDEO_EXTENSIONS.test(url);
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
