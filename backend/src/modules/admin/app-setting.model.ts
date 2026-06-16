import { Schema, model, type Document, type Types } from 'mongoose';

export interface IAppSetting {
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AppSettingDocument = IAppSetting & Document<Types.ObjectId>;

const appSettingSchema = new Schema<AppSettingDocument>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
  },
  { timestamps: true },
);

export const AppSetting = model<AppSettingDocument>('AppSetting', appSettingSchema);
