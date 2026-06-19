import { Router } from 'express';
import { getResumes, createResume, updateResume, deleteResume, setActiveResume } from '../controllers/resume.controller';
import { protect, restrictTo, optionalProtect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { resumeSchema } from '../middleware/schemas';

const router = Router();

// Public listing (only active) or Admin listing (all)
router.get('/', optionalProtect, getResumes);

// Owner/Admin operations
router.post('/', protect, restrictTo('owner', 'admin'), validate(resumeSchema), createResume);
router.patch('/:id', protect, restrictTo('owner', 'admin'), validate(resumeSchema), updateResume);
router.delete('/:id', protect, restrictTo('owner', 'admin'), deleteResume);
router.patch('/:id/active', protect, restrictTo('owner', 'admin'), setActiveResume);

export default router;
