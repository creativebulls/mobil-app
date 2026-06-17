import { Schema, model, type Document, type Types } from 'mongoose';

export type AppealStatus = 'pending' | 'approved' | 'rejected';

export interface IAppeal {
  user: Types.ObjectId;
  message: string;
  status: AppealStatus;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AppealDocument = IAppeal & Document<Types.ObjectId>;

const appealSchema = new Schema<AppealDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

appealSchema.index({ status: 1, createdAt: -1 });

export const Appeal = model<AppealDocument>('Appeal', appealSchema);
