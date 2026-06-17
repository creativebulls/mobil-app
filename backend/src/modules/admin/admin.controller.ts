import { Response } from 'express';

import type { AdminRequest } from '../../shared/middleware/admin.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import * as adminService from './admin.service';
import {
  adminAppealReviewSchema,
  adminAppealsQuerySchema,
  adminLoginSchema,
  adminReportStatusSchema,
  adminReportsQuerySchema,
  adminResetPasswordSchema,
  adminSuspendSchema,
  adminUsersQuerySchema,
  pushConfigSchema,
  pushTestSchema,
} from './admin.validation';

export const login = asyncHandler(async (req, res: Response) => {
  const body = adminLoginSchema.parse(req.body);
  const result = adminService.adminLogin(body.email, body.password);
  sendSuccess(res, result);
});

export const listUsers = asyncHandler(async (req: AdminRequest, res: Response) => {
  const query = adminUsersQuerySchema.parse(req.query);
  const result = await adminService.listUsers(query);
  sendSuccess(res, result);
});

export const forceVerifyUser = asyncHandler(async (req: AdminRequest, res: Response) => {
  const result = await adminService.forceVerifyUser(String(req.params.id));
  sendSuccess(res, result);
});

export const resetUserPassword = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = adminResetPasswordSchema.parse(req.body);
  const result = await adminService.resetUserPassword(String(req.params.id), body.password);
  sendSuccess(res, result);
});

export const deleteUser = asyncHandler(async (req: AdminRequest, res: Response) => {
  const result = await adminService.deleteUser(String(req.params.id));
  sendSuccess(res, result);
});

export const getPushConfig = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.getPushConfig();
  sendSuccess(res, result);
});

export const setPushConfig = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = pushConfigSchema.parse(req.body);
  const result = await adminService.setPushConfig(body.serviceAccount);
  sendSuccess(res, result);
});

export const clearPushConfig = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.clearPushConfig();
  sendSuccess(res, result);
});

export const sendTestPush = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = pushTestSchema.parse(req.body);
  const result = await adminService.sendTestPush(body.email);
  sendSuccess(res, result);
});

export const listReports = asyncHandler(async (req: AdminRequest, res: Response) => {
  const query = adminReportsQuerySchema.parse(req.query);
  const result = await adminService.listReports(query);
  sendSuccess(res, result);
});

export const setReportStatus = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = adminReportStatusSchema.parse(req.body);
  const result = await adminService.setReportStatus(String(req.params.id), body.status);
  sendSuccess(res, result);
});

export const suspendUser = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = adminSuspendSchema.parse(req.body);
  const result = await adminService.suspendUser(String(req.params.id), body.reason);
  sendSuccess(res, result);
});

export const unsuspendUser = asyncHandler(async (req: AdminRequest, res: Response) => {
  const result = await adminService.unsuspendUser(String(req.params.id));
  sendSuccess(res, result);
});

export const listAppeals = asyncHandler(async (req: AdminRequest, res: Response) => {
  const query = adminAppealsQuerySchema.parse(req.query);
  const result = await adminService.listAppeals(query);
  sendSuccess(res, result);
});

export const reviewAppeal = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = adminAppealReviewSchema.parse(req.body);
  const result = await adminService.reviewAppeal(String(req.params.id), body.decision);
  sendSuccess(res, result);
});
