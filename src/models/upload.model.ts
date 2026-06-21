import { Schema, model, Document } from 'mongoose';
import { UploadRecord as IUploadRecord } from '../types';

export interface UploadRecordDocument extends Omit<IUploadRecord, '_id' | 'ownerId'>, Document {
  ownerId: Schema.Types.ObjectId;
}

const UploadRecordSchema = new Schema<UploadRecordDocument>(
  {
    publicId: { type: String, required: true, unique: true },
    secureUrl: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
    format: { type: String, required: true },
    bytes: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    originalName: { type: String, required: true },
    folder: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now, required: true }
  },
  { timestamps: true }
);

// Indexes
UploadRecordSchema.index({ ownerId: 1 });
UploadRecordSchema.index({ ownerId: 1, resourceType: 1, uploadedAt: -1 });

export const UploadRecordModel = model<UploadRecordDocument>('UploadRecord', UploadRecordSchema);
export default UploadRecordModel;
