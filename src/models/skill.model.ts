import { Schema, model, Document } from 'mongoose';
import { Skill as ISkill } from '@portfolio-os/types';

export interface SkillDocument extends Omit<ISkill, '_id' | 'ownerId'>, Document {
  ownerId: Schema.Types.ObjectId;
}

const SkillSchema = new Schema<SkillDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
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

// Indexes — name is unique per-owner, not globally
SkillSchema.index({ ownerId: 1, name: 1 }, { unique: true });
SkillSchema.index({ ownerId: 1, category: 1 });

export const SkillModel = model<SkillDocument>('Skill', SkillSchema);
