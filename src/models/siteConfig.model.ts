import { Schema, model, Document } from 'mongoose';
import { SiteConfig as ISiteConfig } from '@portfolio-os/types';

export interface SiteConfigDocument extends Omit<ISiteConfig, '_id'>, Document {}

const SiteConfigSchema = new Schema<SiteConfigDocument>(
  {
    resumeVersions: [
      {
        label: { type: String, required: true },
        fileUrl: { type: String, required: true }
      }
    ],
    stats: {
      projectsCompleted: { type: Number, required: true, default: 0 },
      clients: { type: Number, required: true, default: 0 },
      internships: { type: Number, required: true, default: 0 },
      certifications: { type: Number, required: true, default: 0 }
    },
    maintenanceMode: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

export const SiteConfigModel = model<SiteConfigDocument>('SiteConfig', SiteConfigSchema);
export default SiteConfigModel;
