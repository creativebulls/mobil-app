import { Router } from 'express';

import * as relationsController from './relations.controller';

export const relationsRouter = Router();

relationsRouter.use(...relationsController.relationsGuards);

relationsRouter.get('/blocked', relationsController.listBlocked);
relationsRouter.get('/restricted', relationsController.listRestricted);
relationsRouter.post('/:userId/block', relationsController.blockUser);
relationsRouter.post('/:userId/unblock', relationsController.unblockUser);
relationsRouter.post('/:userId/restrict', relationsController.restrictUser);
relationsRouter.post('/:userId/unrestrict', relationsController.unrestrictUser);
