import type { Href } from 'expo-router';

import type { UserProfile } from '../api/types';
import { registerForPushNotifications } from '../notifications/pushNotifications';

type AuthRouter = {
  replace: (href: Href) => void;
};

export function routeAfterAuth(router: AuthRouter, user: UserProfile) {
  if (user.suspended) {
    router.replace('/account-suspended');
    return;
  }

  void registerForPushNotifications();

  if (user.registrationCompleted) {
    router.replace('/home');
    return;
  }

  if (user.givenName && user.surname) {
    router.replace('/registration-details');
    return;
  }

  router.replace('/your-name');
}
