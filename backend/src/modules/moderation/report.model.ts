import { Schema, model, type Document, type Types } from 'mongoose';

export type ReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface IReport {
  reporter: Types.ObjectId;
  reportedUser: Types.ObjectId;
  conversation?: Types.ObjectId;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportDocument = IReport & Document<Types.ObjectId>;

const reportSchema = new Schema<ReportDocument>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['open', 'reviewed', 'dismissed'],
      default: 'open',
      index: true,
    },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });

export const Report = model<ReportDocument>('Report', reportSchema);
