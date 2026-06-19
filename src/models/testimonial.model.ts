import { Schema, model, Document } from 'mongoose';
import { Testimonial as ITestimonial } from '@portfolio-os/types';

export interface TestimonialDocument extends Omit<ITestimonial, '_id' | 'relatedProjectId'>, Document {
  relatedProjectId?: Schema.Types.ObjectId;
}

const TestimonialSchema = new Schema<TestimonialDocument>(
  {
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
TestimonialSchema.index({ status: 1, createdAt: -1 });

export const TestimonialModel = model<TestimonialDocument>('Testimonial', TestimonialSchema);
export default TestimonialModel;
