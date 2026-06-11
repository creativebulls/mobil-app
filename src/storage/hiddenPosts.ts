import AsyncStorage from '@react-native-async-storage/async-storage';

const HIDDEN_POSTS_KEY = '@whereabout/hidden_posts';

export async function getHiddenPostIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(HIDDEN_POSTS_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function hidePost(postId: string): Promise<void> {
  const current = await getHiddenPostIds();
  if (current.includes(postId)) {
    return;
  }
  await AsyncStorage.setItem(HIDDEN_POSTS_KEY, JSON.stringify([...current, postId]));
}

export async function clearHiddenPosts(): Promise<void> {
  await AsyncStorage.removeItem(HIDDEN_POSTS_KEY);
}
