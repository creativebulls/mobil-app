import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchUnreadCount } from '../api/notificationsApi';
import type { AppNotification } from '../api/types';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import { getAccessToken } from '../storage/authSession';
import { registerForPushNotifications } from './pushNotifications';

type NotificationsContextValue = {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      return;
    }

    try {
      const result = await fetchUnreadCount();
      setUnreadCount(result.unreadCount);
    } catch {
      // ignore; not authenticated yet or transient error
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const token = await getAccessToken();
      if (token) {
        await registerForPushNotifications();
        await refreshUnreadCount();
      }
    })();
  }, [refreshUnreadCount]);

  useRealtimeEvent<AppNotification>('notification:new', () => {
    setUnreadCount((count) => count + 1);
  });

  useRealtimeEvent<{ unreadCount: number }>('notification:read', (payload) => {
    setUnreadCount(payload.unreadCount);
  });

  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { postId?: string } | undefined;
      router.push({ pathname: '/notifications', params: data?.postId ? { postId: data.postId } : {} });
    });

    return () => responseListener.remove();
  }, []);

  const value = useMemo(
    () => ({ unreadCount, setUnreadCount, refreshUnreadCount }),
    [unreadCount, refreshUnreadCount],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }

  return context;
}
