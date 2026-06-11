import { Schema, model, type Document, type Types } from 'mongoose';

export interface IPasswordReset {
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
}

export type PasswordResetDocument = IPasswordReset & Document<Types.ObjectId>;

const passwordResetSchema = new Schema<PasswordResetDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset = model<PasswordResetDocument>('PasswordReset', passwordResetSchema);
