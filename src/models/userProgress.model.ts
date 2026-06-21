import { Schema, model, Document } from 'mongoose';
import { UserProgressEvent as IUserProgressEvent } from '../types';

export interface UserProgressDocument extends Omit<IUserProgressEvent, '_id' | 'userId'>, Document {
  userId: Schema.Types.ObjectId;
}

const UserProgressSchema = new Schema<UserProgressDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['page_visit', 'project_view', 'badge_earned', 'comment_posted', 'message_sent'],
      required: true
    },
    xpAwarded: { type: Number, required: true },
    metadata: { type: Schema.Types.Map, of: Schema.Types.Mixed }
  },
  { timestamps: true }
);

UserProgressSchema.index({ userId: 1, createdAt: -1 });

export const UserProgressModel = model<UserProgressDocument>('UserProgress', UserProgressSchema);
