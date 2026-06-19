import { Router } from 'express';
import { getGitHubStats } from '../controllers/github.controller';

const router = Router();

// GET /api/v1/github/stats — public, cached GitHub profile + repos
router.get('/stats', getGitHubStats);

export default router;
