import { Schema, model, Document } from 'mongoose';
import { Portfolio as IPortfolio, PortfolioTheme } from '@portfolio-os/types';
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
      enum: ['developer', 'minimal', 'corporate', 'creative', 'portfolio-os'],
      required: true,
      default: 'portfolio-os'
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
    }
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
