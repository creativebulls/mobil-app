import { Response } from 'express';

import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import { listCallHistory } from './call-history.service';
import { getIceServers } from './calls.service';

export const iceServers = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, { iceServers: getIceServers() });
});

export const callHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50;
  const entries = await listCallHistory(req.auth!.userId, limit);
  sendSuccess(res, { entries });
});
