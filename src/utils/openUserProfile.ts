import type { Router } from 'expo-router';

export function openUserProfile(
  router: Router,
  userId: string,
  currentUserId?: string | null,
): void {
  if (currentUserId && userId === currentUserId) {
    router.push('/profile');
    return;
  }

  router.push({ pathname: '/user/[userId]', params: { userId } });
}
