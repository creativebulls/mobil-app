import { Router } from 'express';

import * as profileController from './profile.controller';

export const profileRouter = Router();

profileRouter.use(...profileController.profileGuards);

profileRouter.get('/stats', profileController.getStats);
profileRouter.get('/settings', profileController.getSettings);
profileRouter.patch('/settings', profileController.updateSettings);
profileRouter.get('/users/:userId', profileController.getUserProfile);
profileRouter.patch('/status', profileController.updateStatus);
profileRouter.patch('/personal-info', profileController.updatePersonalInfo);
profileRouter.post('/email-change/send-current-code', profileController.sendCurrentEmailChangeCode);
profileRouter.post('/email-change/verify-current-code', profileController.verifyCurrentEmailChangeCode);
profileRouter.post('/email-change/send-new-code', profileController.sendNewEmailChangeCode);
profileRouter.post('/email-change/confirm', profileController.confirmEmailChange);
profileRouter.get('/posts', profileController.listMyPosts);
profileRouter.get('/favorite-places', profileController.listFavoritePlaces);
