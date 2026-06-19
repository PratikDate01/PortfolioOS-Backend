import { Router } from 'express';
import { getExperiences, createExperience, updateExperience, deleteExperience } from '../controllers/experiences.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { experienceSchema } from '../middleware/schemas';

const router = Router();

router.get('/', getExperiences);

// Admin-only operations
router.post('/', protect, restrictTo('owner', 'admin'), validate(experienceSchema), createExperience);
router.patch('/:id', protect, restrictTo('owner', 'admin'), validate(experienceSchema), updateExperience);
router.delete('/:id', protect, restrictTo('owner', 'admin'), deleteExperience);

export default router;
