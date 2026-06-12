import { Schema, model, type Document, type Types } from 'mongoose';

export interface IConversation {
  participants: Types.ObjectId[];
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageSender?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationDocument = IConversation & Document<Types.ObjectId>;

const conversationSchema = new Schema<ConversationDocument>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }],
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
    lastMessageSender: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = model<ConversationDocument>('Conversation', conversationSchema);
