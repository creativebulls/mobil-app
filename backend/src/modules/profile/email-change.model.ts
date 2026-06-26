import { Schema, model, type Document, type Types } from 'mongoose';

export interface IEmailChange {
  userId: Types.ObjectId;
  currentEmail: string;
  currentCodeHash?: string;
  currentCodeExpiresAt?: Date;
  currentAttempts: number;
  currentVerified: boolean;
  sessionExpiresAt?: Date;
  newEmail?: string;
  newCodeHash?: string;
  newCodeExpiresAt?: Date;
  newAttempts: number;
}

export type EmailChangeDocument = IEmailChange & Document<Types.ObjectId>;

const emailChangeSchema = new Schema<EmailChangeDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    currentEmail: { type: String, required: true, lowercase: true, trim: true },
    currentCodeHash: { type: String },
    currentCodeExpiresAt: { type: Date },
    currentAttempts: { type: Number, default: 0 },
    currentVerified: { type: Boolean, default: false },
    sessionExpiresAt: { type: Date },
    newEmail: { type: String, lowercase: true, trim: true },
    newCodeHash: { type: String },
    newCodeExpiresAt: { type: Date },
    newAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

emailChangeSchema.index({ sessionExpiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export const EmailChange = model<EmailChangeDocument>('EmailChange', emailChangeSchema);
