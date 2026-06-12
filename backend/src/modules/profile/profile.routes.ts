import { Router } from 'express';

import * as profileController from './profile.controller';

export const profileRouter = Router();

profileRouter.use(...profileController.profileGuards);

profileRouter.get('/stats', profileController.getStats);
profileRouter.get('/settings', profileController.getSettings);
profileRouter.patch('/settings', profileController.updateSettings);
profileRouter.get('/users/:userId', profileController.getUserProfile);
profileRouter.patch('/status', profileController.updateStatus);
profileRouter.get('/posts', profileController.listMyPosts);
profileRouter.get('/favorite-places', profileController.listFavoritePlaces);
