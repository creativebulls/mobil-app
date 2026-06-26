import { router } from 'expo-router';
import { navigateFromPushData } from './navigateFromPushData';
import * as Notifications from 'expo-notifications';
import notifee from '@notifee/react-native';
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
import type { AppNotification, ChatMessage } from '../api/types';
import { emitLiveRequest } from '../calls/liveAudioBus';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import { playMessageChime } from '../sounds/sounds';
import { getAccessToken, getStoredUser } from '../storage/authSession';
import { ensureNotificationChannels, registerForPushNotifications, setupRemotePushHandlers } from './pushNotifications';

type NotificationsContextValue = {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  refreshUnreadCount: () => Promise<void>;
  syncPushNotifications: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void getStoredUser().then((user) => setCurrentUserId(user?.id ?? null));
  }, []);

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
    setupRemotePushHandlers();
    void ensureNotificationChannels();
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

  // Play the chime for messages from other people (message:new is also echoed
  // to the sender, so skip our own outgoing messages).
  useRealtimeEvent<ChatMessage>('message:new', (incoming) => {
    if (incoming.senderId && incoming.senderId !== currentUserId) {
      playMessageChime();
    }
  });

  useEffect(() => {
    const receivedListener = Notifications.addNotificationReceivedListener(() => {
      setUnreadCount((count) => count + 1);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;

      if (data?.type === 'live_request' && data.sessionId) {
        emitLiveRequest({
          sessionId: String(data.sessionId),
          adminName: typeof data.adminName === 'string' ? data.adminName : null,
        });
        return;
      }

      if (data?.type === 'incoming_call') {
        return;
      }

      if (navigateFromPushData(data)) {
        return;
      }

      router.push('/notifications');
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) {
        return;
      }
      navigateFromPushData(response.notification.request.content.data as Record<string, unknown>);
    });

    void notifee.getInitialNotification().then((initial) => {
      if (initial?.pressAction?.id === 'default') {
        navigateFromPushData((initial.notification?.data ?? {}) as Record<string, unknown>);
      }
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
