import { Router } from 'express';

import { requireAuth, requireVerifiedEmail } from '../../shared/middleware/auth.middleware';
import * as callsController from './calls.controller';

export const callsRouter = Router();

callsRouter.use(requireAuth, requireVerifiedEmail);

callsRouter.get('/ice-servers', callsController.iceServers);
