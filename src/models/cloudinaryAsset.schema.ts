import { Schema } from 'mongoose';

export const CloudinaryAssetSchema = new Schema(
  {
    publicId: { type: String, required: true },
    secureUrl: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
    format: { type: String, required: true },
    bytes: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);
