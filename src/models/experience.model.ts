import { Schema, model, Document } from 'mongoose';
import { Experience as IExperience } from '../types';

export interface ExperienceDocument extends Omit<IExperience, '_id' | 'ownerId'>, Document {
  ownerId: Schema.Types.ObjectId;
}

const ExperienceSchema = new Schema<ExperienceDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organization: { type: String, required: true },
    role: { type: String, required: true },
    type: {
      type: String,
      enum: ['job', 'internship', 'education', 'achievement'],
      required: true
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    description: { type: String, required: true },
    responsibilities: [{ type: String }],
    technologiesUsed: [{ type: String }],
    order: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

// Indexes
ExperienceSchema.index({ ownerId: 1, type: 1, startDate: -1 });

export const ExperienceModel = model<ExperienceDocument>('Experience', ExperienceSchema);
