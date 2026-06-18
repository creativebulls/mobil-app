import { Schema, model, type Document, type Types } from 'mongoose';

export interface ISharedPlace {
  placeId: string;
  name: string;
  imageUrl?: string;
}

export type MessageMediaType = 'image' | 'video' | 'audio' | 'file';

export interface IMessageMedia {
  url: string;
  mediaType: MessageMediaType;
  width?: number;
  height?: number;
  // Set for audio voice notes and generic file attachments.
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  durationMs?: number;
}

export type CallLogStatus = 'completed' | 'missed' | 'rejected' | 'cancelled';

// A WhatsApp-style call entry rendered inline in the conversation. The message
// `sender` is always the caller, so each client derives direction by comparing
// to its own id.
export interface ICallLog {
  callId: string;
  status: CallLogStatus;
  durationSeconds: number;
}

export interface IMessage {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  // Single recipient for 1:1 chats; undefined for group conversations.
  recipient?: Types.ObjectId;
  text: string;
  sharedPlace?: ISharedPlace;
  media?: IMessageMedia;
  // 1:1 read flag (drives delivery/read ticks).
  read: boolean;
  readAt?: Date;
  // Per-user read tracking used for group conversations (and includes the sender).
  readBy: Types.ObjectId[];
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

const mediaSchema = new Schema<IMessageMedia>(
  {
    url: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video', 'audio', 'file'], required: true },
    width: { type: Number },
    height: { type: Number },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    durationMs: { type: Number },
  },
  { _id: false },
);

const messageSchema = new Schema<MessageDocument>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
    // Text is optional when a place is attached, but a message must carry one or the other.
    text: { type: String, default: '', trim: true, maxlength: 2000 },
    sharedPlace: { type: sharedPlaceSchema, default: undefined },
    media: { type: mediaSchema, default: undefined },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, read: 1 });

export const Message = model<MessageDocument>('Message', messageSchema);
