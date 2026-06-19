import { Router } from 'express';
import {
  getTestimonials,
  createTestimonial,
  updateTestimonialStatus,
  updateTestimonial,
  deleteTestimonial,
} from '../controllers/testimonials.controller';
import { protect, restrictTo, optionalProtect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { testimonialSchema, testimonialStatusSchema } from '../middleware/schemas';

const router = Router();

router.get('/', optionalProtect, getTestimonials);
router.post('/', validate(testimonialSchema), createTestimonial);

// Admin-only testimonial operations
router.patch('/:id/status', protect, restrictTo('owner', 'admin'), validate(testimonialStatusSchema), updateTestimonialStatus);
router.patch('/:id', protect, restrictTo('owner', 'admin'), validate(testimonialSchema), updateTestimonial);
router.delete('/:id', protect, restrictTo('owner', 'admin'), deleteTestimonial);

export default router;
