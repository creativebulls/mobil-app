import { Schema, model, type Document, type Types } from 'mongoose';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'reply'
  | 'comment_like'
  | 'mention'
  | 'friend_request'
  | 'friend_request_accepted';

export interface INotification {
  recipient: Types.ObjectId;
  actor: Types.ObjectId;
  type: NotificationType;
  post?: Types.ObjectId;
  comment?: Types.ObjectId;
  friendRequest?: Types.ObjectId;
  message: string;
  preview?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = INotification & Document<Types.ObjectId>;

const notificationSchema = new Schema<NotificationDocument>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['like', 'comment', 'reply', 'comment_like', 'mention', 'friend_request', 'friend_request_accepted'],
      required: true,
    },
    post: { type: Schema.Types.ObjectId, ref: 'Post' },
    comment: { type: Schema.Types.ObjectId, ref: 'Comment' },
    friendRequest: { type: Schema.Types.ObjectId, ref: 'FriendRequest' },
    message: { type: String, required: true },
    preview: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = model<NotificationDocument>('Notification', notificationSchema);
