import { Schema, model, Document } from 'mongoose';
import { Skill as ISkill } from '@portfolio-os/types';

export interface SkillDocument extends Omit<ISkill, '_id'>, Document {}

const SkillSchema = new Schema<SkillDocument>(
  {
    name: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: ['frontend', 'backend', 'database', 'devops', 'cloud', 'ai', 'other'],
      required: true
    },
    proficiency: { type: Number, required: true, min: 1, max: 100 },
    yearsExperience: { type: Number, required: true, default: 0 },
    relatedProjectIds: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
    iconUrl: { type: String }
  },
  { timestamps: true }
);

// Indexes
SkillSchema.index({ category: 1 });

export const SkillModel = model<SkillDocument>('Skill', SkillSchema);
