import { Schema, model, type Document, type Types } from 'mongoose';

export interface IPostSave {
  user: Types.ObjectId;
  post: Types.ObjectId;
  createdAt: Date;
}

export type PostSaveDocument = IPostSave & Document<Types.ObjectId>;

const postSaveSchema = new Schema<PostSaveDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

postSaveSchema.index({ user: 1, post: 1 }, { unique: true });
postSaveSchema.index({ user: 1, createdAt: -1 });
postSaveSchema.index({ post: 1 });

export const PostSave = model<PostSaveDocument>('PostSave', postSaveSchema);
