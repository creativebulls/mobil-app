import { Response } from 'express';

import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import { getIceServers } from './calls.service';

export const iceServers = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, { iceServers: getIceServers() });
});
