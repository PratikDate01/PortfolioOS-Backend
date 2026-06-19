import { Schema, model, Document } from 'mongoose';
import { User as IUser } from '@portfolio-os/types';
import { CloudinaryAssetSchema } from './cloudinaryAsset.schema';

export interface UserDocument extends Omit<IUser, '_id'>, Document {}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'github', 'guest'],
      required: true,
      default: 'local'
    },
    providerId: { type: String },
    avatarUrl: { type: String },
    profileImage: { type: CloudinaryAssetSchema },
    coverImage: { type: CloudinaryAssetSchema },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'guest'],
      required: true,
      default: 'guest'
    },
    bio: { type: String },
    socialLinks: {
      github: { type: String },
      linkedin: { type: String },
      twitter: { type: String },
      website: { type: String }
    },
    xp: { type: Number, required: true, default: 0 },
    level: { type: Number, required: true, default: 1 },
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
