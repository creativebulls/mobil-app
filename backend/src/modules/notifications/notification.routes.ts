import { Router } from 'express';

import * as notificationController from './notification.controller';

export const notificationRouter = Router();

notificationRouter.use(...notificationController.notificationGuards);

notificationRouter.get('/', notificationController.listNotifications);
notificationRouter.get('/unread-count', notificationController.unreadCount);
notificationRouter.post('/read', notificationController.markRead);
notificationRouter.post('/push-token', notificationController.registerPushToken);
notificationRouter.delete('/push-token', notificationController.removePushToken);
