import { Schema, model, Document } from 'mongoose';
import { Project as IProject } from '@portfolio-os/types';
import { CloudinaryAssetSchema } from './cloudinaryAsset.schema';

export interface ProjectDocument extends Omit<IProject, '_id' | 'ownerId'>, Document {
  ownerId: Schema.Types.ObjectId;
}

const ProjectSchema = new Schema<ProjectDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    description: { type: String, required: true },
    coverImageUrl: { type: String, required: true },
    thumbnail: { type: CloudinaryAssetSchema },
    gallery: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], required: true },
        caption: { type: String },
        publicId: { type: String },
        secureUrl: { type: String },
        resourceType: { type: String, enum: ['image', 'video', 'raw'] },
        format: { type: String },
        bytes: { type: Number },
        width: { type: Number },
        height: { type: Number },
        uploadedAt: { type: Date }
      }
    ],
    demoVideo: { type: CloudinaryAssetSchema },
    architectureDiagram: { type: CloudinaryAssetSchema },
    techStack: [{ type: String }],
    category: { type: String, required: true },
    tags: [{ type: String }],
    links: {
      github: { type: String },
      liveDemo: { type: String },
      docs: { type: String }
    },
    caseStudy: {
      problem: { type: String },
      research: { type: String },
      architecture: { type: String },
      challenges: { type: String },
      solutions: { type: String },
      results: { type: String },
      metrics: [
        {
          label: { type: String, required: true },
          value: { type: String, required: true }
        }
      ],
      lessonsLearned: { type: String }
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      required: true,
      default: 'draft'
    },
    featured: { type: Boolean, required: true, default: false },
    viewCount: { type: Number, required: true, default: 0 },
    order: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

// Indexes — slug is unique per-owner, not globally
ProjectSchema.index({ ownerId: 1, slug: 1 }, { unique: true });
ProjectSchema.index({ ownerId: 1, status: 1, featured: 1, order: 1 });
ProjectSchema.index({ title: 'text', tags: 'text' });

export const ProjectModel = model<ProjectDocument>('Project', ProjectSchema);
