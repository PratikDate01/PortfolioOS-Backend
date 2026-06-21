import { Schema, model, Document } from 'mongoose';
import { Badge as IBadge } from '../types';

export interface BadgeDocument extends Omit<IBadge, '_id'>, Document {}

const BadgeSchema = new Schema<BadgeDocument>(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    iconUrl: { type: String, required: true },
    xpReward: { type: Number, required: true, default: 0 },
    criteria: { type: String, required: true }
  },
  { timestamps: true }
);

export const BadgeModel = model<BadgeDocument>('Badge', BadgeSchema);
