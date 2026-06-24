import { Schema, model, type Document, type Types } from 'mongoose';

export interface IPostPlace {
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
  createdAt: Date;
  updatedAt: Date;
}

export type PostDocument = IPost & Document<Types.ObjectId>;

const postPlaceSchema = new Schema<IPostPlace>(
  {
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
  },
  { timestamps: true },
);

postSchema.index({ createdAt: -1 });

export const Post = model<PostDocument>('Post', postSchema);
