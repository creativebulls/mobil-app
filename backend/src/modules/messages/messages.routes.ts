import { Router } from 'express';

import * as messagesController from './messages.controller';

export const messagesRouter = Router();

messagesRouter.use(...messagesController.messagesGuards);

messagesRouter.get('/', messagesController.listConversations);
messagesRouter.get('/unread-count', messagesController.unreadCount);
messagesRouter.post('/group', messagesController.createGroup);
messagesRouter.post('/with/:userId', messagesController.openConversation);
messagesRouter.post('/share-place', messagesController.sharePlace);
messagesRouter.post('/conversation-place', messagesController.sharePlaceInConversation);
messagesRouter.post(
  '/media',
  messagesController.sendMediaMessageMiddleware,
  messagesController.sendMediaMessage,
);
messagesRouter.post('/', messagesController.sendMessage);
messagesRouter.get('/:conversationId', messagesController.listMessages);
messagesRouter.post('/:conversationId/read', messagesController.markRead);
