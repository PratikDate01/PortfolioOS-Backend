import { Schema, model, Document } from 'mongoose';
import { Certification as ICertification } from '@portfolio-os/types';
import { CloudinaryAssetSchema } from './cloudinaryAsset.schema';

export interface CertificationDocument extends Omit<ICertification, '_id' | 'ownerId'>, Document {
  ownerId: Schema.Types.ObjectId;
}

const CertificationSchema = new Schema<CertificationDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    issuer: { type: String, required: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date },
    credentialUrl: { type: String },
    imageUrl: { type: String, required: true },
    certificateImage: { type: CloudinaryAssetSchema },
    certificatePdf: { type: CloudinaryAssetSchema },
    skills: [{ type: String }],
    category: { type: String, required: true }
  },
  { timestamps: true }
);

// Indexes
CertificationSchema.index({ ownerId: 1, category: 1 });
CertificationSchema.index({ ownerId: 1, issueDate: -1 });

export const CertificationModel = model<CertificationDocument>('Certification', CertificationSchema);
export default CertificationModel;
