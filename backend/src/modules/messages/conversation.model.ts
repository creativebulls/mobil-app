import { Schema, model, type Document, type Types } from 'mongoose';

export interface IConversation {
  participants: Types.ObjectId[];
  isGroup: boolean;
  name?: string;
  owner?: Types.ObjectId;
  avatarUrl?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageSender?: Types.ObjectId;
  // Per-user "delete chat history" markers: messages at/before this time are
  // hidden from that participant, and the chat drops off their list until a
  // newer message arrives.
  clearedAt?: Map<string, Date>;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationDocument = IConversation & Document<Types.ObjectId>;

const conversationSchema = new Schema<ConversationDocument>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }],
    isGroup: { type: Boolean, default: false },
    name: { type: String, trim: true, maxlength: 80 },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
    avatarUrl: { type: String },
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
    lastMessageSender: { type: Schema.Types.ObjectId, ref: 'User' },
    clearedAt: { type: Map, of: Date, default: undefined },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = model<ConversationDocument>('Conversation', conversationSchema);
