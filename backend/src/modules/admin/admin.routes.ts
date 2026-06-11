import { Router } from 'express';

import { requireAdmin } from '../../shared/middleware/admin.middleware';
import * as adminController from './admin.controller';

export const adminRouter = Router();

adminRouter.post('/login', adminController.login);

adminRouter.use(requireAdmin);

adminRouter.get('/users', adminController.listUsers);
adminRouter.post('/users/:id/verify', adminController.forceVerifyUser);
adminRouter.post('/users/:id/reset-password', adminController.resetUserPassword);
adminRouter.delete('/users/:id', adminController.deleteUser);
