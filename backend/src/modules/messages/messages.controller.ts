import { Response } from 'express';

import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { messageMediaUpload, groupPhotoUpload } from '../../shared/middleware/upload.middleware';
import { AppError } from '../../shared/errors/AppError';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import {
  conversationIdParamSchema,
  createGroupSchema,
  messagesQuerySchema,
  renameGroupSchema,
  sendMediaMessageSchema,
  sendMessageSchema,
  sharePlaceInConversationSchema,
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

export const sendMediaMessageMiddleware = messageMediaUpload.single('file');

export const sendMediaMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new AppError(422, 'A media file is required', 'MEDIA_REQUIRED');
  }

  const body = sendMediaMessageSchema.parse(req.body);

  const result = await messagesService.sendMediaMessage(
    req.auth!.userId,
    body.conversationId ?? null,
    body.recipientId ?? null,
    {
      filename: file.filename,
      mediaType: body.mediaType,
      width: body.width,
      height: body.height,
    },
    body.text ?? '',
  );
  sendSuccess(res, result, 201);
});

export const createGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createGroupSchema.parse(req.body);
  const result = await messagesService.createGroup(req.auth!.userId, body.name, body.memberIds);
  sendSuccess(res, result, 201);
});

export const getGroupDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = conversationIdParamSchema.parse(req.params);
  const result = await messagesService.getGroupDetails(req.auth!.userId, params.conversationId);
  sendSuccess(res, result);
});

export const renameGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = conversationIdParamSchema.parse(req.params);
  const body = renameGroupSchema.parse(req.body);
  const result = await messagesService.renameGroup(req.auth!.userId, params.conversationId, body.name);
  sendSuccess(res, result);
});

export const deleteGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = conversationIdParamSchema.parse(req.params);
  const result = await messagesService.deleteGroup(req.auth!.userId, params.conversationId);
  sendSuccess(res, result);
});

export const leaveGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = conversationIdParamSchema.parse(req.params);
  const result = await messagesService.leaveGroup(req.auth!.userId, params.conversationId);
  sendSuccess(res, result);
});

export const uploadGroupPhotoMiddleware = groupPhotoUpload.single('groupPhoto');

export const uploadGroupPhoto = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = conversationIdParamSchema.parse(req.params);
  const file = req.file;
  if (!file) {
    throw new AppError(422, 'A group photo is required', 'GROUP_PHOTO_REQUIRED');
  }

  const result = await messagesService.updateGroupPhoto(
    req.auth!.userId,
    params.conversationId,
    file.filename,
  );
  sendSuccess(res, result);
});

export const sharePlaceInConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = sharePlaceInConversationSchema.parse(req.body);
  const result = await messagesService.sharePlaceInConversation(
    req.auth!.userId,
    { conversationId: body.conversationId, recipientId: body.recipientId },
    { placeId: body.placeId, name: body.name, imageUrl: body.imageUrl ?? null },
    body.note,
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
