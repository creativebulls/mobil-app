import { Router } from 'express';

import * as messagesController from './messages.controller';

export const messagesRouter = Router();

messagesRouter.use(...messagesController.messagesGuards);

messagesRouter.get('/', messagesController.listConversations);
messagesRouter.get('/unread-count', messagesController.unreadCount);
messagesRouter.post('/group', messagesController.createGroup);
messagesRouter.get('/group/:conversationId', messagesController.getGroupDetails);
messagesRouter.patch('/group/:conversationId', messagesController.renameGroup);
messagesRouter.delete('/group/:conversationId', messagesController.deleteGroup);
messagesRouter.post('/group/:conversationId/leave', messagesController.leaveGroup);
messagesRouter.post(
  '/group/:conversationId/photo',
  messagesController.uploadGroupPhotoMiddleware,
  messagesController.uploadGroupPhoto,
);
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
