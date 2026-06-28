import { Schema, model, Document } from 'mongoose';
import { Portfolio as IPortfolio, PortfolioTheme } from '../types';
import { CloudinaryAssetSchema } from './cloudinaryAsset.schema';

export interface PortfolioDocument extends Omit<IPortfolio, '_id' | 'ownerId'>, Document {
  ownerId: Schema.Types.ObjectId;
}

const PortfolioSchema = new Schema<PortfolioDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    headline: { type: String },
    bio: { type: String },
    profileImage: { type: CloudinaryAssetSchema },
    coverImage: { type: CloudinaryAssetSchema },
    githubUsername: { type: String },
    socialLinks: {
      github: { type: String },
      linkedin: { type: String },
      twitter: { type: String },
      website: { type: String }
    },
    theme: {
      type: String,
      enum: ['portfolio-os', 'developer-pro', 'executive', 'creative', 'terminal'],
      required: true,
      default: 'developer-pro'
    },
    defaultTheme: {
      type: String,
      default: 'developer-pro'
    },
    accentColor: { type: String },
    fontStyle: { type: String },
    borderRadius: { type: String },
    animationLevel: { type: String },
    themeSettings: {
      type: Schema.Types.Mixed,
      default: {}
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      required: true,
      default: 'public'
    },
    customDomain: { type: String },
    seoSettings: {
      title: { type: String },
      description: { type: String },
      ogImage: { type: String }
    },
    analyticsSettings: {
      enabled: { type: Boolean, default: true }
    },
    showProfilePhoto: { type: Boolean, required: true, default: true },
    showPortfolioViews: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

// Indexes
PortfolioSchema.index({ customDomain: 1 }, { 
  unique: true, 
  partialFilterExpression: { customDomain: { $exists: true, $type: 'string', $ne: '' } } 
});

export const PortfolioModel = model<PortfolioDocument>('Portfolio', PortfolioSchema);
export default PortfolioModel;
