import { Router } from 'express';

import * as placesController from './places.controller';

export const placesRouter = Router();

placesRouter.use(...placesController.placesGuards);

placesRouter.get('/', placesController.getPlaces);
placesRouter.get('/search', placesController.searchPlaces);
placesRouter.get('/:id', placesController.getPlaceDetails);
placesRouter.get('/:id/engagement', placesController.getPlaceEngagement);
placesRouter.post('/:id/like', placesController.togglePlaceLike);
placesRouter.post('/:id/visit', placesController.recordPlaceVisit);
placesRouter.get('/:id/comments', placesController.listPlaceComments);
placesRouter.post('/:id/comments', placesController.addPlaceComment);
placesRouter.get('/:id/posts', placesController.getPlacePosts);
