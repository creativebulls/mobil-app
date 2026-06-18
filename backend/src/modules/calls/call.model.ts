import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * Final outcome of a call. `ringing`/`ongoing` are transient states used while a
 * call is in progress; they are finalized into one of the terminal states once
 * the call ends.
 */
export type CallStatus =
  | 'ringing'
  | 'ongoing'
  | 'completed'
  | 'missed'
  | 'rejected'
  | 'cancelled';

export interface ICall {
  callId: string;
  caller: Types.ObjectId;
  callee: Types.ObjectId;
  conversationId?: Types.ObjectId | null;
  // Name/avatar snapshots so history rows render without extra lookups even if
  // the user later changes their profile.
  callerName: string;
  callerAvatar?: string | null;
  calleeName: string;
  calleeAvatar?: string | null;
  status: CallStatus;
  startedAt: Date;
  answeredAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CallDocument = ICall & Document<Types.ObjectId>;

const callSchema = new Schema<CallDocument>(
  {
    callId: { type: String, required: true, unique: true, index: true },
    caller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    callee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
    callerName: { type: String, required: true },
    callerAvatar: { type: String, default: null },
    calleeName: { type: String, required: true },
    calleeAvatar: { type: String, default: null },
    status: {
      type: String,
      enum: ['ringing', 'ongoing', 'completed', 'missed', 'rejected', 'cancelled'],
      default: 'ringing',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Fast lookup of a user's history, newest first.
callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ callee: 1, createdAt: -1 });

export const Call = model<CallDocument>('Call', callSchema);
