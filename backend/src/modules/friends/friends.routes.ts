import { Router } from 'express';

import * as friendsController from './friends.controller';

export const friendsRouter = Router();

friendsRouter.use(...friendsController.friendsGuards);

friendsRouter.get('/search', friendsController.searchUsers);
friendsRouter.get('/meet-people', friendsController.getMeetPeople);
friendsRouter.get('/connect-code', friendsController.getMyConnectCode);
friendsRouter.get('/connect/:code', friendsController.resolveConnectCode);
friendsRouter.get('/locations', friendsController.listFriendLocations);
friendsRouter.get('/', friendsController.listFriends);
friendsRouter.get('/:userId/friends', friendsController.listUserFriends);
friendsRouter.post('/:userId/request', friendsController.sendFriendRequest);
friendsRouter.post('/requests/:requestId/accept', friendsController.acceptFriendRequest);
friendsRouter.post('/requests/:requestId/reject', friendsController.rejectFriendRequest);
