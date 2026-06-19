import { Schema, model, Document } from 'mongoose';
import { Message as IMessage } from '@portfolio-os/types';
import { CloudinaryAssetSchema } from './cloudinaryAsset.schema';

export interface MessageDocument extends Omit<IMessage, '_id'>, Document {}

const MessageSchema = new Schema<MessageDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String },
    body: { type: String, required: true },
    attachmentUrl: { type: String },
    attachment: { type: CloudinaryAssetSchema },
    status: {
      type: String,
      enum: ['unread', 'read', 'replied', 'archived'],
      required: true,
      default: 'unread'
    },
    source: {
      type: String,
      enum: ['contact_form', 'whatsapp_click', 'calendar_booking'],
      required: true,
      default: 'contact_form'
    }
  },
  { timestamps: true }
);

// Indexes
MessageSchema.index({ status: 1, createdAt: -1 });

export const MessageModel = model<MessageDocument>('Message', MessageSchema);
