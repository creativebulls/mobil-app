import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchUnreadMessageCount } from '../api/messagesApi';
import { useRealtimeEvent } from './useRealtimeEvent';

export function useUnreadMessageCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const result = await fetchUnreadMessageCount();
      setUnreadCount(result.unreadCount);
    } catch {
      // Non-critical; leave the badge as-is.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUnread();
    }, [loadUnread]),
  );

  useRealtimeEvent('message:new', () => {
    void loadUnread();
  });
  useRealtimeEvent('message:read', () => {
    void loadUnread();
  });

  return unreadCount;
}
