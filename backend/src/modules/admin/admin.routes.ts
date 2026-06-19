import { Router } from 'express';

import { requireAdmin } from '../../shared/middleware/admin.middleware';
import * as adminController from './admin.controller';

export const adminRouter = Router();

adminRouter.post('/login', adminController.login);

adminRouter.use(requireAdmin);

adminRouter.get('/stats', adminController.stats);

adminRouter.get('/app-config', adminController.getAppConfig);
adminRouter.put('/app-config', adminController.setAppConfig);

adminRouter.get('/users', adminController.listUsers);
adminRouter.get('/users/:id', adminController.userDetail);
adminRouter.post('/users/:id/verify', adminController.forceVerifyUser);
adminRouter.post('/users/:id/reset-password', adminController.resetUserPassword);
adminRouter.post('/users/:id/suspend', adminController.suspendUser);
adminRouter.post('/users/:id/unsuspend', adminController.unsuspendUser);
adminRouter.post('/users/:id/live-audio', adminController.setLiveAudioEnabled);
adminRouter.delete('/users/:id', adminController.deleteUser);

adminRouter.get('/reports', adminController.listReports);
adminRouter.post('/reports/:id/status', adminController.setReportStatus);

adminRouter.get('/appeals', adminController.listAppeals);
adminRouter.post('/appeals/:id/review', adminController.reviewAppeal);

adminRouter.get('/ice-servers', adminController.iceServers);

adminRouter.get('/push-config', adminController.getPushConfig);
adminRouter.put('/push-config', adminController.setPushConfig);
adminRouter.delete('/push-config', adminController.clearPushConfig);
adminRouter.post('/push-config/test', adminController.sendTestPush);
