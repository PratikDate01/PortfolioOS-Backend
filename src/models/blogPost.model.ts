import { Schema, model, Document } from 'mongoose';
import { BlogPost as IBlogPost } from '../types';
import { CloudinaryAssetSchema } from './cloudinaryAsset.schema';

export interface BlogPostDocument extends Omit<IBlogPost, '_id' | 'authorId' | 'ownerId'>, Document {
  ownerId: Schema.Types.ObjectId;
  authorId: Schema.Types.ObjectId;
}

const BlogPostSchema = new Schema<BlogPostDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    contentMarkdown: { type: String, required: true },
    coverImageUrl: { type: String },
    coverImage: { type: CloudinaryAssetSchema },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categories: [{ type: String }],
    tags: [{ type: String }],
    status: {
      type: String,
      enum: ['draft', 'published'],
      required: true,
      default: 'draft'
    },
    readingTimeMinutes: { type: Number, required: true, default: 0 },
    viewCount: { type: Number, required: true, default: 0 },
    likeCount: { type: Number, required: true, default: 0 },
    publishedAt: { type: Date }
  },
  { timestamps: true }
);

// Indexes — slug is unique per-owner
BlogPostSchema.index({ ownerId: 1, slug: 1 }, { unique: true });
BlogPostSchema.index({ ownerId: 1, status: 1, publishedAt: -1 });
BlogPostSchema.index({ title: 'text', contentMarkdown: 'text' });

export const BlogPostModel = model<BlogPostDocument>('BlogPost', BlogPostSchema);
export default BlogPostModel;
