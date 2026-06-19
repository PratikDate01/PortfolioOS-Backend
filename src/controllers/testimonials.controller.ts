import { Request, Response } from 'express';
import { TestimonialModel } from '../models/testimonial.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getTestimonials = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};

    const userRole = req.user?.role;
    if (userRole === 'owner' || userRole === 'admin') {
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

export const updateTestimonialStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const testimonial = await TestimonialModel.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    res.status(200).json({ data: testimonial });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating testimonial status' });
  }
};

export const updateTestimonial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const testimonialData = req.body;

    const testimonial = await TestimonialModel.findByIdAndUpdate(id, testimonialData, {
      new: true,
      runValidators: true,
    });

    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    res.status(200).json({ data: testimonial });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating testimonial' });
  }
};

export const deleteTestimonial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const testimonial = await TestimonialModel.findByIdAndDelete(id);

    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    res.status(200).json({ data: testimonial, message: 'Testimonial deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting testimonial' });
  }
};
