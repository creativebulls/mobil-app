import { Router } from 'express';

import * as moderationController from './moderation.controller';

export const moderationRouter = Router();

moderationRouter.post('/reports', ...moderationController.reportGuards, moderationController.createReport);
moderationRouter.post('/appeals', ...moderationController.appealGuards, moderationController.createAppeal);
moderationRouter.get('/appeals/me', ...moderationController.appealGuards, moderationController.getMyAppeal);
