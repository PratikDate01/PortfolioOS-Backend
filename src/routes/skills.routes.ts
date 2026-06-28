import { Router } from 'express';
import { getSkills, createSkill, updateSkill, deleteSkill } from '../controllers/skills.controller';
import { protect, restrictTo, optionalProtect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { skillSchema } from '../middleware/schemas';

const router = Router();

router.get('/', optionalProtect, getSkills);

// Admin-only operations
router.post('/', protect, restrictTo('owner', 'admin'), validate(skillSchema), createSkill);
router.patch('/:id', protect, restrictTo('owner', 'admin'), validate(skillSchema), updateSkill);
router.delete('/:id', protect, restrictTo('owner', 'admin'), deleteSkill);

export default router;
