import { Response } from 'express';

import type { AdminRequest } from '../../shared/middleware/admin.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import { getIceServers } from '../calls/calls.service';
import * as adminService from './admin.service';
import {
  adminAppealReviewSchema,
  adminAppealsQuerySchema,
  adminLiveAudioSchema,
  adminLoginSchema,
  adminReportStatusSchema,
  adminReportsQuerySchema,
  adminResetPasswordSchema,
  adminSuspendSchema,
  adminUsersQuerySchema,
  appConfigSchema,
  googlePlacesConfigSchema,
  googleMapsConfigSchema,
  placesCategoriesSchema,
  placesConfigSchema,
  placesProFieldsSchema,
  placesProviderSchema,
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

export const getPlacesConfig = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.getPlacesConfig();
  sendSuccess(res, result);
});

export const setPlacesConfig = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = placesConfigSchema.parse(req.body);
  const result = await adminService.setPlacesConfig(body.apiKey);
  sendSuccess(res, result);
});

export const clearPlacesConfig = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.clearPlacesConfig();
  sendSuccess(res, result);
});

export const setPlacesProFields = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = placesProFieldsSchema.parse(req.body);
  const result = await adminService.setPlacesProFields(body.enabled);
  sendSuccess(res, result);
});

export const setPlacesProvider = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = placesProviderSchema.parse(req.body);
  const result = await adminService.setPlacesProvider(body.provider);
  sendSuccess(res, result);
});

export const setGooglePlacesConfig = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = googlePlacesConfigSchema.parse(req.body);
  const result = await adminService.setGooglePlacesConfig(body.apiKey);
  sendSuccess(res, result);
});

export const clearGooglePlacesConfig = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.clearGooglePlacesConfig();
  sendSuccess(res, result);
});

export const getMapsConfig = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.getMapsConfig();
  sendSuccess(res, result);
});

export const setMapsConfig = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = googleMapsConfigSchema.parse(req.body);
  const result = await adminService.setMapsConfig(body.apiKey);
  sendSuccess(res, result);
});

export const clearMapsConfig = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.clearMapsConfig();
  sendSuccess(res, result);
});

export const setPlacesCategories = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = placesCategoriesSchema.parse(req.body);
  const result = await adminService.setPlacesCategories(body.keys);
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

export const setLiveAudioEnabled = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = adminLiveAudioSchema.parse(req.body);
  const result = await adminService.setLiveAudioEnabled(String(req.params.id), body.enabled);
  sendSuccess(res, result);
});

export const iceServers = asyncHandler(async (_req: AdminRequest, res: Response) => {
  sendSuccess(res, { iceServers: getIceServers() });
});

export const stats = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.getStats();
  sendSuccess(res, result);
});

export const userDetail = asyncHandler(async (req: AdminRequest, res: Response) => {
  const result = await adminService.getUserDetail(String(req.params.id));
  sendSuccess(res, result);
});

export const getAppConfig = asyncHandler(async (_req: AdminRequest, res: Response) => {
  const result = await adminService.getAppConfig();
  sendSuccess(res, result);
});

export const setAppConfig = asyncHandler(async (req: AdminRequest, res: Response) => {
  const body = appConfigSchema.parse(req.body);
  const result = await adminService.setAppConfig(body.config);
  sendSuccess(res, result);
});

// Public (unauthenticated) endpoint so the mobile client can fetch live config.
export const publicAppConfig = asyncHandler(async (_req, res: Response) => {
  const result = await adminService.getPublicAppConfig();
  sendSuccess(res, { config: result.config });
});
