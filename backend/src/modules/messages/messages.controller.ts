import { Response } from 'express';

import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import {
  conversationIdParamSchema,
  messagesQuerySchema,
  sendMessageSchema,
  sharePlaceSchema,
  userIdParamSchema,
} from './messages.validation';
import * as messagesService from './messages.service';

export const messagesGuards = [requireAuth, requireVerifiedEmail];

export const listConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await messagesService.listConversations(req.auth!.userId);
  sendSuccess(res, result);
});

export const unreadCount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const count = await messagesService.getTotalUnread(req.auth!.userId);
  sendSuccess(res, { unreadCount: count });
});

export const openConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = userIdParamSchema.parse(req.params);
  const result = await messagesService.getOrCreateConversationWith(req.auth!.userId, params.userId);
  sendSuccess(res, result);
});

export const listMessages = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = conversationIdParamSchema.parse(req.params);
  const query = messagesQuerySchema.parse(req.query);
  const result = await messagesService.listMessages(
    req.auth!.userId,
    params.conversationId,
    query.limit,
    query.before,
  );
  sendSuccess(res, result);
});

export const sendMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = sendMessageSchema.parse(req.body);
  const result = await messagesService.sendMessage(
    req.auth!.userId,
    body.conversationId ?? null,
    body.recipientId ?? null,
    body.text,
  );
  sendSuccess(res, result, 201);
});

export const sharePlace = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = sharePlaceSchema.parse(req.body);
  const result = await messagesService.sharePlaceWithContacts(
    req.auth!.userId,
    { placeId: body.placeId, name: body.name, imageUrl: body.imageUrl ?? null },
    body.recipientIds,
    body.note,
  );
  sendSuccess(res, result, 201);
});

export const markRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = conversationIdParamSchema.parse(req.params);
  const result = await messagesService.markConversationRead(req.auth!.userId, params.conversationId);
  sendSuccess(res, result);
});
