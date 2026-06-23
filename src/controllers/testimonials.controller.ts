import { Request, Response } from 'express';
import { TestimonialModel } from '../models/testimonial.model';
import { UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getTestimonials = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, username } = req.query;
    const filter: Record<string, any> = {};

    // Enforce tenant boundary
    if (username) {
      const user = await UserModel.findOne({ username: String(username).toLowerCase().trim() });
      if (!user) {
        res.status(200).json({ data: [] });
        return;
      }
      filter.portfolioOwnerId = user._id;
    } else if (req.user?.id) {
      filter.portfolioOwnerId = req.user.id;
    } else {
      res.status(400).json({ error: 'username query parameter is required for public requests' });
      return;
    }

    const userRole = req.user?.role;
    const isOwner = req.user?.id && filter.portfolioOwnerId && req.user.id.toString() === filter.portfolioOwnerId.toString();
    const isAdmin = userRole === 'superadmin' || userRole === 'admin';

    if (isAdmin || isOwner) {
      if (status) {
        filter.status = status;
      }
    } else {
      filter.status = 'approved';
    }

    const testimonials = await TestimonialModel.find(filter)
      .populate('relatedProjectId', 'title slug')
      .sort({ createdAt: -1 });

    res.status(200).json({ data: testimonials });
  } catch (error) {
    res.status(500).json({ error: 'Server error listing testimonials' });
  }
};

export const createTestimonial = async (req: Request, res: Response): Promise<void> => {
  try {
    const testimonialData = req.body;
    
    // Resolve portfolioOwnerId if username is provided instead of ID
    if (!testimonialData.portfolioOwnerId && testimonialData.username) {
      const user = await UserModel.findOne({ username: String(testimonialData.username).toLowerCase().trim() });
      if (user) {
        testimonialData.portfolioOwnerId = user._id;
      }
    }

    if (!testimonialData.portfolioOwnerId) {
      res.status(400).json({ error: 'portfolioOwnerId is required' });
      return;
    }

    // Set status to pending by default for public submission
    const testimonial = new TestimonialModel({
      ...testimonialData,
      status: 'pending',
    });
    await testimonial.save();
    res.status(201).json({ data: testimonial });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating testimonial' });
  }
};

export const updateTestimonialStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const testimonial = await TestimonialModel.findById(id);
    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    if (testimonial.portfolioOwnerId.toString() !== ownerId) {
      res.status(403).json({ error: 'Not authorized to edit this testimonial' });
      return;
    }

    const updated = await TestimonialModel.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );
    res.status(200).json({ data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating testimonial status' });
  }
};

export const updateTestimonial = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const testimonialData = req.body;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const testimonial = await TestimonialModel.findById(id);
    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    if (testimonial.portfolioOwnerId.toString() !== ownerId) {
      res.status(403).json({ error: 'Not authorized to edit this testimonial' });
      return;
    }

    const updated = await TestimonialModel.findByIdAndUpdate(id, testimonialData, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({ data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating testimonial' });
  }
};

export const deleteTestimonial = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.id;

    if (!ownerId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const testimonial = await TestimonialModel.findById(id);
    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    if (testimonial.portfolioOwnerId.toString() !== ownerId) {
      res.status(403).json({ error: 'Not authorized to delete this testimonial' });
      return;
    }

    await TestimonialModel.findByIdAndDelete(id);

    res.status(200).json({ data: testimonial, message: 'Testimonial deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting testimonial' });
  }
};
