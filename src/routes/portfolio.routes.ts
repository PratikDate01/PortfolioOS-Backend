import { Router } from 'express';
import { getPortfolioByUsername, updateMyPortfolio } from '../controllers/portfolio.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

// Public route to view portfolio by username
router.get('/:username', getPortfolioByUsername);

// Protected route to edit logged-in user's portfolio settings
router.patch('/me', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), updateMyPortfolio);

export default router;
