import { Schema, model, type Document, type Types } from 'mongoose';

export type RegistrationStatus = 'pending_email' | 'pending_profile' | 'completed';
export type AccountType = 'individual' | 'business';

export interface IUser {
  email: string;
  passwordHash?: string;
  appleId?: string;
  googleId?: string;
  accountType: AccountType;
  profilePhotoUrl?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  givenName?: string;
  surname?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  birthdate?: Date;
  gender?: string;
  registrationCompleted: boolean;
  registrationStatus: RegistrationStatus;
  termsConsentAt?: Date;
  parentalConsent: boolean;
  parentalConsentAt?: Date;
  refreshTokens: Array<{ tokenId: string; expiresAt: Date }>;
  expoPushTokens: string[];
  statusText?: string;
  points: number;
  isPrivate: boolean;
  pushPreferences: PushPreferences;
  connectCode?: string;
  suspended: boolean;
  suspendedAt?: Date;
  suspensionReason?: string;
  liveAudioEnabled: boolean;
  lastLocation?: UserLastLocation;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLastLocation {
  latitude: number;
  longitude: number;
  updatedAt: Date;
}

export interface PushPreferences {
  likes: boolean;
  comments: boolean;
  friendRequests: boolean;
  messages: boolean;
}

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  likes: true,
  comments: true,
  friendRequests: true,
  messages: true,
};

export type UserDocument = IUser & Document<Types.ObjectId>;

const refreshTokenSchema = new Schema(
  {
    tokenId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    appleId: { type: String, unique: true, sparse: true, trim: true },
    googleId: { type: String, unique: true, sparse: true, trim: true },
    accountType: {
      type: String,
      enum: ['individual', 'business'],
      default: 'individual',
    },
    profilePhotoUrl: { type: String },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    givenName: { type: String, trim: true },
    surname: { type: String, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    birthdate: { type: Date },
    gender: { type: String, trim: true },
    registrationCompleted: { type: Boolean, default: false },
    registrationStatus: {
      type: String,
      enum: ['pending_email', 'pending_profile', 'completed'],
      default: 'pending_email',
    },
    termsConsentAt: { type: Date },
    parentalConsent: { type: Boolean, default: false },
    parentalConsentAt: { type: Date },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
    expoPushTokens: { type: [String], default: [] },
    statusText: { type: String, trim: true, maxlength: 150 },
    points: { type: Number, default: 0, min: 0 },
    isPrivate: { type: Boolean, default: false },
    pushPreferences: {
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      friendRequests: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
    },
    connectCode: { type: String, unique: true, sparse: true },
    suspended: { type: Boolean, default: false, index: true },
    suspendedAt: { type: Date },
    suspensionReason: { type: String, trim: true, maxlength: 500 },
    liveAudioEnabled: { type: Boolean, default: false },
    lastLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true },
);

export const User = model<UserDocument>('User', userSchema);

export function getUserDisplayName(user: Pick<IUser, 'givenName' | 'surname' | 'firstName' | 'lastName' | 'email'>): string {
  if (user.givenName && user.surname) {
    return `${user.givenName} ${user.surname}`;
  }

  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }

  if (user.firstName) {
    return user.firstName;
  }

  if (user.givenName) {
    return user.givenName;
  }

  return user.email.split('@')[0];
}

export function getUserHandle(user: Pick<IUser, 'username' | 'email'>): string {
  return user.username ?? user.email.split('@')[0];
}

export type AuthorSummary = {
  id: string;
  name: string;
  avatarUri: string | null;
};

export function serializeAuthor(user: UserDocument): AuthorSummary {
  return {
    id: user._id.toString(),
    name: getUserDisplayName(user),
    avatarUri: user.profilePhotoUrl ?? null,
  };
}

export function serializeUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    email: user.email,
    profilePhotoUrl: user.profilePhotoUrl ?? null,
    emailVerified: user.emailVerified,
    givenName: user.givenName ?? null,
    surname: user.surname ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    username: user.username ?? null,
    birthdate: user.birthdate?.toISOString() ?? null,
    gender: user.gender ?? null,
    registrationCompleted: user.registrationCompleted,
    registrationStatus: user.registrationStatus,
    accountType: user.accountType ?? 'individual',
    parentalConsent: user.parentalConsent,
    statusText: user.statusText ?? null,
    points: user.points ?? 0,
    isPrivate: user.isPrivate ?? false,
    pushPreferences: { ...DEFAULT_PUSH_PREFERENCES, ...(user.pushPreferences ?? {}) },
    suspended: user.suspended ?? false,
    suspensionReason: user.suspensionReason ?? null,
    liveAudioEnabled: user.liveAudioEnabled ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
