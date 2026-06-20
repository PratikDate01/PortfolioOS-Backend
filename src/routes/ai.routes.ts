import { Router } from 'express';
import {
  chatWithAI,
  parseResume,
  generateBio,
  generateProjectDesc,
  extractSkills,
  formatExperience,
  optimizeSeo,
  reviewPortfolio,
  reviewResume,
  generatePortfolioTemplate
} from '../controllers/ai.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

// POST /api/v1/ai/chat — public (rate-limited), send message, get AI reply
router.post('/chat', chatWithAI);

// Protected SaaS AI endpoints (available to registered users)
router.post('/resume/parse', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), parseResume);
router.post('/bio/generate', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), generateBio);
router.post('/project-desc/generate', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), generateProjectDesc);
router.post('/skills/extract', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), extractSkills);
router.post('/experience/format', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), formatExperience);
router.post('/seo/optimize', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), optimizeSeo);
router.post('/portfolio/review', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), reviewPortfolio);
router.post('/resume/review', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), reviewResume);
router.post('/portfolio/generate', protect, restrictTo('owner', 'admin', 'superadmin', 'user'), generatePortfolioTemplate);

export default router;
