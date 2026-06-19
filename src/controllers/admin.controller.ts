import { Response } from 'express';
import { ProjectModel } from '../models/project.model';
import { BlogPostModel } from '../models/blogPost.model';
import { CertificationModel } from '../models/certification.model';
import { MessageModel } from '../models/message.model';
import { TestimonialModel } from '../models/testimonial.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getAdminStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const totalProjects = await ProjectModel.countDocuments();

    // Blog stats aggregation
    const blogTotal = await BlogPostModel.countDocuments();
    const blogPublished = await BlogPostModel.countDocuments({ status: 'published' });
    const blogDraft = await BlogPostModel.countDocuments({ status: 'draft' });
    const blogViewsResult = await BlogPostModel.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$viewCount' }, totalLikes: { $sum: '$likeCount' } } }
    ]);
    const totalBlogViews = blogViewsResult[0]?.totalViews || 0;
    const totalBlogLikes = blogViewsResult[0]?.totalLikes || 0;

    // Certifications
    const totalCertifications = await CertificationModel.countDocuments();

    // Messages stats
    const messageTotal = await MessageModel.countDocuments();
    const messageUnread = await MessageModel.countDocuments({ status: 'unread' });
    const messageRead = await MessageModel.countDocuments({ status: 'read' });
    const messageReplied = await MessageModel.countDocuments({ status: 'replied' });
    const messageArchived = await MessageModel.countDocuments({ status: 'archived' });

    // Testimonials stats
    const testimonialTotal = await TestimonialModel.countDocuments();
    const testimonialPending = await TestimonialModel.countDocuments({ status: 'pending' });
    const testimonialApproved = await TestimonialModel.countDocuments({ status: 'approved' });
    const testimonialRejected = await TestimonialModel.countDocuments({ status: 'rejected' });

    res.status(200).json({
      data: {
        projects: {
          total: totalProjects,
        },
        blog: {
          total: blogTotal,
          published: blogPublished,
          draft: blogDraft,
          totalViews: totalBlogViews,
          totalLikes: totalBlogLikes,
        },
        certifications: {
          total: totalCertifications,
        },
        messages: {
          total: messageTotal,
          unread: messageUnread,
          read: messageRead,
          replied: messageReplied,
          archived: messageArchived,
        },
        testimonials: {
          total: testimonialTotal,
          pending: testimonialPending,
          approved: testimonialApproved,
          rejected: testimonialRejected,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error aggregating admin stats' });
  }
};
