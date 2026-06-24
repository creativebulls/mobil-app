import * as VideoThumbnails from 'expo-video-thumbnails';

/** Extracts a JPEG poster frame from a local video file for previews. */
export async function createVideoThumbnail(videoUri: string): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 500,
      quality: 0.85,
    });
    return uri;
  } catch {
    return null;
  }
}
