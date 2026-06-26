/** Extract unique lowercase hashtags from post text (without the # prefix). */
export function extractHashtags(text?: string | null): string[] {
  if (!text) {
    return [];
  }

  const matches = text.match(/#([a-zA-Z0-9_]{2,50})/g) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}
