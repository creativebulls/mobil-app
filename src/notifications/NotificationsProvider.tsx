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
import { AppState } from 'react-native';

import { fetchUnreadCount } from '../api/notificationsApi';
import type { AppNotification } from '../api/types';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import { getAccessToken } from '../storage/authSession';
import { registerForPushNotifications } from './pushNotifications';

type NotificationsContextValue = {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  refreshUnreadCount: () => Promise<void>;
  syncPushNotifications: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const result = await fetchUnreadCount();
      setUnreadCount(result.unreadCount);
    } catch {
      // ignore; not authenticated yet or transient error
    }
  }, []);

  const syncPushNotifications = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }

    await registerForPushNotifications();
    await refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    void syncPushNotifications();
  }, [syncPushNotifications]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncPushNotifications();
      }
    });

    return () => subscription.remove();
  }, [syncPushNotifications]);

  useRealtimeEvent<AppNotification>('notification:new', () => {
    setUnreadCount((count) => count + 1);
  });

  useRealtimeEvent<{ unreadCount: number }>('notification:read', (payload) => {
    setUnreadCount(payload.unreadCount);
  });

  useEffect(() => {
    const receivedListener = Notifications.addNotificationReceivedListener(() => {
      setUnreadCount((count) => count + 1);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { postId?: string; friendRequestId?: string; type?: string; conversationId?: string }
        | undefined;

      if (data?.type === 'message' && data.conversationId) {
        router.push({ pathname: '/chat', params: { conversationId: data.conversationId } });
        return;
      }

      if (data?.postId) {
        router.push({ pathname: '/comments', params: { postId: data.postId } });
        return;
      }

      if (data?.type === 'friend_request' || data?.type === 'friend_request_accepted') {
        router.push('/notifications');
        return;
      }

      router.push('/notifications');
    });

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, []);

  const value = useMemo(
    () => ({ unreadCount, setUnreadCount, refreshUnreadCount, syncPushNotifications }),
    [unreadCount, refreshUnreadCount, syncPushNotifications],
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
