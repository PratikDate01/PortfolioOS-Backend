import { Router } from 'express';
import { getProjects, getProjectBySlug, createProject, updateProject, deleteProject } from '../controllers/projects.controller';
import { protect, restrictTo, optionalProtect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { projectSchema } from '../middleware/schemas';

const router = Router();

router.get('/', optionalProtect, getProjects);
router.get('/:slug', optionalProtect, getProjectBySlug);

// Admin-only operations
router.post('/', protect, restrictTo('owner', 'admin'), validate(projectSchema), createProject);
router.patch('/:id', protect, restrictTo('owner', 'admin'), validate(projectSchema), updateProject);
router.delete('/:id', protect, restrictTo('owner', 'admin'), deleteProject);

export default router;
