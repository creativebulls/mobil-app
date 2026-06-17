import { Router } from 'express';

import * as postController from './post.controller';

export const postRouter = Router();

postRouter.use(...postController.postGuards);

postRouter.get('/', postController.getFeed);
postRouter.post('/', postController.createPostMiddleware, postController.createPost);
postRouter.get('/search', postController.searchPosts);
postRouter.get('/:id', postController.getPost);
postRouter.delete('/:id', postController.deletePost);
postRouter.post('/:id/like', postController.toggleLike);
postRouter.get('/:id/comments', postController.listComments);
postRouter.post('/:id/comments', postController.addComment);

export const commentRouter = Router();

commentRouter.use(...postController.postGuards);

commentRouter.get('/:commentId/replies', postController.listReplies);
commentRouter.post('/:commentId/like', postController.toggleCommentLike);
