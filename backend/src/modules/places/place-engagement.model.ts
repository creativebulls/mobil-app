import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * Places come from an external provider (OpenTripMap/sample/Google), so we key
 * engagement by the provider's string `placeId` rather than a local Post id.
 */

export interface IPlaceComment {
  placeId: string;
  author: Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PlaceCommentDocument = IPlaceComment & Document<Types.ObjectId>;

const placeCommentSchema = new Schema<PlaceCommentDocument>(
  {
    placeId: { type: String, required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

export const PlaceComment = model<PlaceCommentDocument>('PlaceComment', placeCommentSchema);

export interface IPlaceLike {
  placeId: string;
  user: Types.ObjectId;
  createdAt: Date;
}

export type PlaceLikeDocument = IPlaceLike & Document<Types.ObjectId>;

const placeLikeSchema = new Schema<PlaceLikeDocument>(
  {
    placeId: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

placeLikeSchema.index({ placeId: 1, user: 1 }, { unique: true });

export const PlaceLike = model<PlaceLikeDocument>('PlaceLike', placeLikeSchema);

export interface IPlaceVisit {
  placeId: string;
  user: Types.ObjectId;
  createdAt: Date;
}

export type PlaceVisitDocument = IPlaceVisit & Document<Types.ObjectId>;

const placeVisitSchema = new Schema<PlaceVisitDocument>(
  {
    placeId: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

placeVisitSchema.index({ placeId: 1, user: 1 }, { unique: true });

export const PlaceVisit = model<PlaceVisitDocument>('PlaceVisit', placeVisitSchema);
