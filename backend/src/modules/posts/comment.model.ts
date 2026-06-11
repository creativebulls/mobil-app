import { Schema, model, type Document, type Types } from 'mongoose';

export interface IComment {
  post: Types.ObjectId;
  author: Types.ObjectId;
  parent?: Types.ObjectId;
  text: string;
  likes: Types.ObjectId[];
  repliesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CommentDocument = IComment & Document<Types.ObjectId>;

const commentSchema = new Schema<CommentDocument>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', index: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    likes: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    repliesCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, parent: 1, createdAt: -1 });

export const Comment = model<CommentDocument>('Comment', commentSchema);
