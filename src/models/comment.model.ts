import { Schema, model, Document } from 'mongoose';
import { Comment as IComment } from '@portfolio-os/types';

export interface CommentDocument extends Omit<IComment, '_id' | 'postId' | 'authorId' | 'parentCommentId'>, Document {
  postId: Schema.Types.ObjectId;
  authorId: Schema.Types.ObjectId;
  parentCommentId?: Schema.Types.ObjectId;
}

const CommentSchema = new Schema<CommentDocument>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'BlogPost', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    parentCommentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
    status: {
      type: String,
      enum: ['visible', 'flagged', 'removed'],
      required: true,
      default: 'visible'
    }
  },
  { timestamps: true }
);

// Indexes
CommentSchema.index({ postId: 1, createdAt: -1 });

export const CommentModel = model<CommentDocument>('Comment', CommentSchema);
export default CommentModel;
