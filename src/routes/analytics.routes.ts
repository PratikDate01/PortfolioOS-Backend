import { Router } from 'express';
import { recordVisit, getVisitorCount, logEvent } from '../controllers/analytics.controller';
import { optionalProtect } from '../middleware/auth.middleware';

const router = Router();

// POST /api/v1/analytics/visit — public, records a visit and returns total count
router.post('/visit', recordVisit);

// GET /api/v1/analytics/visitors — public, returns visitor counts
router.get('/visitors', getVisitorCount);

// POST /api/v1/analytics/events — logs details for clicks, downloads, or view actions
router.post('/events', optionalProtect, logEvent);

export default router;
