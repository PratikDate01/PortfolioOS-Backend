import { Schema, model, Document } from 'mongoose';
import { Bookmark as IBookmark } from '@portfolio-os/types';

export interface BookmarkDocument extends Omit<IBookmark, '_id' | 'userId' | 'targetId'>, Document {
  userId: Schema.Types.ObjectId;
  targetId: Schema.Types.ObjectId;
}

const BookmarkSchema = new Schema<BookmarkDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: {
      type: String,
      enum: ['project', 'blogpost'],
      required: true
    },
    targetId: { type: Schema.Types.ObjectId, required: true }
  },
  { timestamps: true }
);

// Ensure a user can only bookmark a specific target once
BookmarkSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

export const BookmarkModel = model<BookmarkDocument>('Bookmark', BookmarkSchema);
