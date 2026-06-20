import { Schema, model, Document } from 'mongoose';

export interface AnalyticsEventDocument extends Document {
  portfolioOwnerId: Schema.Types.ObjectId;
  sessionId: string;
  userId?: string;
  type: 'page_view' | 'download' | 'outbound_click' | 'project_view';
  path: string;
  referrer?: string;
  country?: string;
  device?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<AnalyticsEventDocument>(
  {
    portfolioOwnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['page_view', 'download', 'outbound_click', 'project_view'],
      required: true
    },
    path: { type: String, required: true },
    referrer: { type: String },
    country: { type: String },
    device: { type: String },
    metadata: { type: Schema.Types.Map, of: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index to automatically expire events after 90 days
AnalyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
AnalyticsEventSchema.index({ portfolioOwnerId: 1, type: 1, createdAt: -1 });
AnalyticsEventSchema.index({ portfolioOwnerId: 1, createdAt: -1 });

export const AnalyticsEventModel = model<AnalyticsEventDocument>('AnalyticsEvent', AnalyticsEventSchema);
