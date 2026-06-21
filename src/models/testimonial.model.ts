import { Schema, model, Document } from 'mongoose';
import { Testimonial as ITestimonial } from '../types';

export interface TestimonialDocument extends Omit<ITestimonial, '_id' | 'relatedProjectId' | 'portfolioOwnerId'>, Document {
  portfolioOwnerId: Schema.Types.ObjectId;
  relatedProjectId?: Schema.Types.ObjectId;
}

const TestimonialSchema = new Schema<TestimonialDocument>(
  {
    portfolioOwnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    authorCompany: { type: String },
    authorAvatarUrl: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, required: true },
    videoUrl: { type: String },
    relatedProjectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: true,
      default: 'pending'
    }
  },
  { timestamps: true }
);

// Indexes
TestimonialSchema.index({ portfolioOwnerId: 1, status: 1, createdAt: -1 });

export const TestimonialModel = model<TestimonialDocument>('Testimonial', TestimonialSchema);
export default TestimonialModel;
