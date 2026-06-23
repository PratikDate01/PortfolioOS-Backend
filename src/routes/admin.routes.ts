import { Router } from 'express';
import { getAdminStats } from '../controllers/admin.controller';
import { getAnalyticsSummary } from '../controllers/analytics.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

router.get('/stats', protect, restrictTo('admin'), getAdminStats);
router.get('/analytics', protect, restrictTo('admin'), getAnalyticsSummary);

export default router;

