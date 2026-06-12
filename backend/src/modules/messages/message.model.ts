import { Schema, model, type Document, type Types } from 'mongoose';

export interface ISharedPlace {
  placeId: string;
  name: string;
  imageUrl?: string;
}

export interface IMessage {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  text: string;
  sharedPlace?: ISharedPlace;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageDocument = IMessage & Document<Types.ObjectId>;

const sharedPlaceSchema = new Schema<ISharedPlace>(
  {
    placeId: { type: String, required: true },
    name: { type: String, required: true },
    imageUrl: { type: String },
  },
  { _id: false },
);

const messageSchema = new Schema<MessageDocument>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Text is optional when a place is attached, but a message must carry one or the other.
    text: { type: String, default: '', trim: true, maxlength: 2000 },
    sharedPlace: { type: sharedPlaceSchema, default: undefined },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, read: 1 });

export const Message = model<MessageDocument>('Message', messageSchema);
