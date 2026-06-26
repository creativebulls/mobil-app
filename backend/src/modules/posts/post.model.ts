import { Schema, model, type Document, type Types } from 'mongoose';

export interface IPostPlace {
  placeId?: string;
  name: string;
  logoUrl?: string;
  distanceKm?: number;
}

export type PostReaction = 'like' | 'dislike' | 'love';

export interface IPost {
  author: Types.ObjectId;
  text?: string;
  imageUrl?: string;
  images: string[];
  /** Maps post video URL → JPEG poster URL for feed previews. */
  videoThumbnails?: Record<string, string>;
  reaction?: PostReaction;
  place?: IPostPlace;
  likes: Types.ObjectId[];
  commentsCount: number;
  viewsCount: number;
  hashtags: string[];
  mentionedUsers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type PostDocument = IPost & Document<Types.ObjectId>;

const postPlaceSchema = new Schema<IPostPlace>(
  {
    placeId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    logoUrl: { type: String },
    distanceKm: { type: Number },
  },
  { _id: false },
);

const postSchema = new Schema<PostDocument>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, trim: true, maxlength: 2000 },
    imageUrl: { type: String },
    images: { type: [String], default: [] },
    videoThumbnails: { type: Schema.Types.Mixed, default: {} },
    reaction: { type: String, enum: ['like', 'dislike', 'love'] },
    place: { type: postPlaceSchema },
    likes: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    commentsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    hashtags: { type: [String], default: [] },
    mentionedUsers: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { timestamps: true },
);

postSchema.index({ createdAt: -1 });

export const Post = model<PostDocument>('Post', postSchema);
