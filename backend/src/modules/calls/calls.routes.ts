import { Router } from 'express';

import { requireAuth, requireNotSuspended, requireVerifiedEmail } from '../../shared/middleware/auth.middleware';
import * as callsController from './calls.controller';

export const callsRouter = Router();

callsRouter.use(requireAuth, requireVerifiedEmail, requireNotSuspended);

callsRouter.get('/ice-servers', callsController.iceServers);
