import { Schema, model, Document, Types } from 'mongoose';
import { Subscription as ISubscription, SubscriptionTier, SubscriptionLimits, SUBSCRIPTION_PLAN_LIMITS } from '../types';

export interface SubscriptionDocument extends Omit<ISubscription, '_id' | 'userId'>, Document {
  userId: Schema.Types.ObjectId;
}

const SubscriptionLimitsSchema = new Schema(
  {
    maxProjects: { type: Number, required: true },
    maxStorageMB: { type: Number, required: true },
    maxThemes: { type: Number, required: true },
    aiUsagePerMonth: { type: Number, required: true },
    customDomain: { type: Boolean, required: true },
    analyticsAccess: { type: String, enum: ['basic', 'full'], required: true }
  },
  { _id: false }
);

const SubscriptionSchema = new Schema<SubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tier: {
      type: String,
      enum: ['free', 'pro', 'premium', 'enterprise'],
      required: true,
      default: 'free'
    },
    limits: { type: SubscriptionLimitsSchema, required: true },
    startsAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date },
    isActive: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

// Indexes
SubscriptionSchema.index({ tier: 1 });

/**
 * Create a default free-tier subscription for a user.
 */
export function createDefaultSubscription(userId: Types.ObjectId | Schema.Types.ObjectId | string) {
  return new SubscriptionModel({
    userId,
    tier: 'free',
    limits: SUBSCRIPTION_PLAN_LIMITS.free,
    startsAt: new Date(),
    isActive: true
  });
}

export const SubscriptionModel = model<SubscriptionDocument>('Subscription', SubscriptionSchema);
export default SubscriptionModel;
