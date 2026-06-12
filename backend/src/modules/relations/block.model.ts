import { Schema, model, type Document, type Types } from 'mongoose';

export type RelationType = 'block' | 'restrict';

export interface IUserRelation {
  owner: Types.ObjectId;
  target: Types.ObjectId;
  type: RelationType;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRelationDocument = IUserRelation & Document<Types.ObjectId>;

const userRelationSchema = new Schema<UserRelationDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    target: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['block', 'restrict'], required: true },
  },
  { timestamps: true },
);

userRelationSchema.index({ owner: 1, target: 1 }, { unique: true });

export const UserRelation = model<UserRelationDocument>('UserRelation', userRelationSchema);
