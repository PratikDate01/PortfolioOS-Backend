import { Schema, model, Document } from 'mongoose';
import { Resume as IResume } from '../types';
import { CloudinaryAssetSchema } from './cloudinaryAsset.schema';

export interface ResumeDocument extends Omit<IResume, '_id' | 'userId'>, Document {
  userId: Schema.Types.ObjectId;
}

const ResumeSchema = new Schema<ResumeDocument>(
  {
    label: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resumeFile: { type: CloudinaryAssetSchema, required: true },
    isActive: { type: Boolean, required: true, default: false },
    fileName: { type: String, required: true, default: 'Resume.pdf' },
    mimeType: { type: String, required: true, default: 'application/pdf' }
  },
  { timestamps: true }
);

// Indexes
ResumeSchema.index({ userId: 1, isActive: 1 });

export const ResumeModel = model<ResumeDocument>('Resume', ResumeSchema);
export default ResumeModel;
