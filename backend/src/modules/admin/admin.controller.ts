import { Response } from 'express';

import type { AdminRequest } from '../../shared/middleware/admin.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import * as adminService from './admin.service';
import {
  adminLoginSchema,
  adminResetPasswordSchema,
  adminUsersQuerySchema,
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
