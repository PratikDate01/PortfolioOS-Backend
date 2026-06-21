import { Schema, model, Document } from 'mongoose';
import { User as IUser, SaaSRole, SubscriptionTier } from '../types';
import { CloudinaryAssetSchema } from './cloudinaryAsset.schema';

export interface UserDocument extends Omit<IUser, '_id'>, Document {}

const UserSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'github'],
      required: true,
      default: 'local'
    },
    providerId: { type: String },
    avatarUrl: { type: String },
    profileImage: { type: CloudinaryAssetSchema },
    coverImage: { type: CloudinaryAssetSchema },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'user', 'guest'],
      required: true,
      default: 'user'
    },
    bio: { type: String },
    socialLinks: {
      github: { type: String },
      linkedin: { type: String },
      twitter: { type: String },
      website: { type: String }
    },
    githubUsername: { type: String },
    subscriptionTier: {
      type: String,
      enum: ['free', 'pro', 'premium', 'enterprise'],
      required: true,
      default: 'free'
    },
    badgeIds: [{ type: Schema.Types.ObjectId, ref: 'Badge' }],
    refreshTokenHash: { type: String },
    isVerified: { type: Boolean, required: true, default: false },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

// Indexes
UserSchema.index(
  { authProvider: 1, providerId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { providerId: { $exists: true, $type: 'string' } } 
  }
);

export const UserModel = model<UserDocument>('User', UserSchema);
