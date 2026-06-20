import { Schema, model, Document } from 'mongoose';
import { AuditLog as IAuditLog } from '@portfolio-os/types';

export interface AuditLogDocument extends Omit<IAuditLog, '_id' | 'actorId'>, Document {
  actorId: Schema.Types.ObjectId;
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String },
    details: { type: Schema.Types.Mixed },
    ip: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });
// TTL: auto-expire audit logs after 1 year
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLogModel = model<AuditLogDocument>('AuditLog', AuditLogSchema);
export default AuditLogModel;
